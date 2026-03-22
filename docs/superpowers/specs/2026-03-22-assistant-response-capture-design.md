# Assistant Response Capture & Full-Text Storage Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track AI assistant responses as `assistant.response` timeline cards in the `user` lane, paired with `user.message` events to form a visible conversation unit. Simultaneously remove artificial body/command truncation across all runtimes.

**Architecture:** New `"assistant.response"` event kind in `core/domain.ts` → new `/api/assistant-response` server endpoint → new Claude Code `Stop` hook + OpenCode `message.updated` extension. Truncation removed from `body`/`command` fields in all Claude Code hooks and the OpenCode plugin. No DB migration needed — the events table stores `kind` as a free string.

**Tech Stack:** TypeScript, Zod, Hono/Express router, Vitest.

---

## Scope

### In scope
- New `"assistant.response"` event kind (core, server, hooks, plugin)
- Claude Code: new `Stop` hook (`.claude/hooks/stop.ts`)
- OpenCode: emit `assistant.response` in `message.updated` handler
- Remove body/command truncation in: `terminal.ts`, `explore.ts`, `common.ts` (Claude Code) and OpenCode plugin
- Server: new `TaskAssistantResponseInput` type, `assistantResponseSchema`, `logAssistantResponse` service method, `/api/assistant-response` route
- Unit tests for new server method and hook behavior

### Out of scope
- Visual grouping / conversation thread UI (UI card renders automatically via existing generic card mechanism)
- Streaming partial responses (only final turn captured)
- Title truncation (120-char title stays as-is — it is display-only)
- Tool output truncation (only input/body truncation fixed)

---

## Data Sources

### Claude Code — `Stop` hook

Claude Code fires the `Stop` hook after each assistant turn completes. Payload shape:

```json
{
  "session_id": "abc123",
  "stop_reason": "end_turn",
  "hook_event_name": "Stop",
  "transcript": [
    { "role": "user", "content": "Fix the bug" },
    { "role": "assistant", "content": "I'll fix the bug now..." }
  ],
  "usage": {
    "input_tokens": 1200,
    "output_tokens": 340,
    "cache_read_input_tokens": 800,
    "cache_creation_input_tokens": 0
  }
}
```

**Transcript extraction:** Find the last entry with `role === "assistant"`. Its `content` may be:
- A plain `string` — use directly.
- An **array of content blocks** (common when the turn includes tool calls): extract only `{ type: "text" }` blocks and concatenate their `text` fields. If no text blocks exist (e.g., pure tool-use turn), treat as empty response.

If `transcript` is absent or has no assistant entry, send with empty body and `title = "Response (${stopReason})"`.

### OpenCode — `message.updated` event

Already handled in `extractAssistantTurnCompletion`. The `event.properties` for `message.updated` also contains:

```json
{
  "info": { "role": "assistant", "id": "msg-1", "sessionID": "s1", "finish": "stop",
            "tokens": { "input": 1200, "output": 340 }, "time": { "created": 0, "completed": 1 } },
  "parts": [{ "type": "text", "text": "I'll fix the bug now..." }]
}
```

Extract text via existing `extractTextFromParts(Array.isArray(properties.parts) ? properties.parts : [])`. Token counts from `info.tokens`. **Note:** cache token counts (`cache.read`, `cache.write`) are available in `info.tokens.cache` but are not captured — only `input` and `output` are included for simplicity and parity with the available field names.

---

## New Event Kind

### `packages/core/src/domain.ts` — **single atomic change**

Both edits must be committed together. Adding the union member without the switch case produces a TypeScript exhaustiveness error across the entire monorepo.

1. Add to `MonitoringEventKind` union:
```typescript
| "assistant.response"
```

2. Add to `defaultLaneForEventKind` switch (no `default` branch — exhaustiveness is enforced):
```typescript
case "assistant.response":
  return "user";
```

---

## Server Changes

> **Implementation order:** Apply the `packages/core/src/domain.ts` change first. Every server file that references `kind: "assistant.response"` will fail TypeScript compilation until `MonitoringEventKind` includes `"assistant.response"`. The domain change is a prerequisite for all files in this section.

### `packages/server/src/application/types.ts`

`sessionId` is optional (matching every other event input type in this file):

```typescript
export interface TaskAssistantResponseInput {
  readonly taskId: string;
  readonly sessionId?: string;         // optional — consistent with other event input types
  readonly messageId: string;
  readonly source: string;             // "claude-hook" | "opencode-plugin"
  readonly title: string;              // ellipsized first line (120 chars)
  readonly body?: string;              // full response text
  readonly metadata?: Record<string, unknown>;
  // metadata carries: stopReason, inputTokens, outputTokens, cacheReadTokens, cacheCreateTokens
}
```

### `packages/server/src/presentation/schemas.ts`

`sessionId` is optional in the schema as well, consistent with `userMessageSchema` where some fields are optional:

```typescript
export const assistantResponseSchema = z.object({
  taskId:    z.string().min(1),
  sessionId: z.string().min(1).optional(),
  messageId: z.string().min(1),
  source:    z.string().min(1),
  title:     z.string().min(1),
  body:      z.string().optional(),
  metadata:  z.record(z.unknown()).optional()
});
```

### `packages/server/src/application/monitor-service.ts`

1. Add `TaskAssistantResponseInput` to the existing named import from `./types.js` at the top of the file.

2. Add new method:
```typescript
async logAssistantResponse(input: TaskAssistantResponseInput): Promise<RecordedEventEnvelope> {
  await this.requireTask(input.taskId);
  return this.recorder.record({
    taskId: input.taskId,
    kind: "assistant.response",
    title: input.title,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.body      ? { body: input.body }           : {}),
    metadata: {
      ...(input.metadata ?? {}),
      messageId: input.messageId,
      source:    input.source
    }
  });
}
```

### `packages/server/src/presentation/http/routes/event-routes.ts`

1. Add `assistantResponseSchema` to the schema imports at the top of the file.
2. Add `TaskAssistantResponseInput` to the types imports at the top of the file.
3. Inside `createEventRoutes()`, add the new route alongside the other event routes:

```typescript
router.post("/api/assistant-response", async (req, res) => {
  res.json(
    await service.logAssistantResponse(
      assistantResponseSchema.parse(req.body) as TaskAssistantResponseInput
    )
  );
});
```

---

## Claude Code Hook Changes

### New file: `.claude/hooks/stop.ts`

`content` may be a string or an array of content blocks. Extract text from both:

```typescript
import {
  createMessageId,
  ellipsize,
  ensureRuntimeSession,
  getSessionId,
  hookLog,
  hookLogPayload,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is Record<string, unknown> =>
      typeof block === "object" && block !== null &&
      (block as Record<string, unknown>).type === "text"
    )
    .map(block => String(block.text ?? ""))
    .join("\n")
    .trim();
}

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("stop", payload);
  const sessionId = getSessionId(payload);
  if (!sessionId) {
    hookLog("stop", "skipped — no sessionId");
    return;
  }

  const stopReason = toTrimmedString(payload.stop_reason) || "end_turn";

  // Extract last assistant message from transcript
  const transcript = Array.isArray(payload.transcript) ? payload.transcript : [];
  const lastAssistant = [...transcript]
    .reverse()
    .find((m): m is Record<string, unknown> =>
      typeof m === "object" && m !== null &&
      (m as Record<string, unknown>).role === "assistant"
    );
  const responseText = lastAssistant ? extractTextFromContent(lastAssistant.content) : "";

  const title = responseText
    ? ellipsize(responseText, 120)
    : `Response (${stopReason})`;

  const ids = await ensureRuntimeSession(sessionId);

  const usage = payload.usage as Record<string, unknown> | undefined;

  await postJson("/api/assistant-response", {
    taskId:    ids.taskId,
    sessionId: ids.sessionId,
    messageId: createMessageId(),
    source:    "claude-hook",
    title,
    ...(responseText ? { body: responseText } : {}),
    metadata: {
      stopReason,
      ...(usage?.input_tokens               != null ? { inputTokens:       usage.input_tokens }               : {}),
      ...(usage?.output_tokens              != null ? { outputTokens:      usage.output_tokens }              : {}),
      ...(usage?.cache_read_input_tokens    != null ? { cacheReadTokens:   usage.cache_read_input_tokens }    : {}),
      ...(usage?.cache_creation_input_tokens != null ? { cacheCreateTokens: usage.cache_creation_input_tokens } : {})
    }
  });

  hookLog("stop", "assistant-response posted", { stopReason, hasText: !!responseText });
}

void main().catch((err: unknown) => {
  hookLog("stop", "ERROR", { error: String(err) });
});
```

### `.claude/settings.json`

Inside the existing top-level `"hooks"` object, add a new `"Stop"` key alongside `"SessionStart"`, `"UserPromptSubmit"`, etc.:

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "NODE_ENV=development node \"node_modules/tsx/dist/cli.mjs\" \".claude/hooks/stop.ts\""
      }
    ]
  }
]
```

### Truncation fixes — `.claude/hooks/terminal.ts`

Remove artificial caps on `body` and `command`:

| Before | After |
|--------|-------|
| `command: command.slice(0, MAX_COMMAND_LENGTH)` (500) | `command: command` |
| ``body: description ? `${description}\n\n$ ${command.slice(0, 300)}` `` | ``body: description ? `${description}\n\n$ ${command}` `` |
| ``body: `Intent: ${description}\nAction: $ ${command.slice(0, 200)}` `` | ``body: `Intent: ${description}\nAction: $ ${command}` `` |
| `metadata: { command: command.slice(0, 200) }` | `metadata: { command }` |

Remove the `MAX_COMMAND_LENGTH` constant entirely.

### Truncation fixes — `.claude/hooks/explore.ts`

| Before | After |
|--------|-------|
| ``body = `Web lookup: ${query.slice(0, 200)}` `` | ``body = `Web lookup: ${query}` `` |

### Truncation fixes — `.claude/hooks/common.ts`

`stringifyToolInput` default `maxValueLength`: `200` → `10000`.

---

## OpenCode Plugin Changes

### `.opencode/plugins/monitor.ts`

**Add local `ellipsize` helper** (the plugin is self-contained and does not import from Claude Code hooks):

```typescript
function ellipsize(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
```

Place this alongside the existing `pluginLog` and `toNonEmptyString` helpers.

**In the `message.updated` handler**, after `extractAssistantTurnCompletion` returns successfully and before `finalizeSession`:

```typescript
// Extract response text from parts if available
const parts = Array.isArray(properties.parts) ? properties.parts : [];
const responseText = extractTextFromParts(parts);
const tokensObj = asObject(asObject(properties.info).tokens);
const inputTokens  = typeof tokensObj.input  === "number" ? tokensObj.input  : undefined;
const outputTokens = typeof tokensObj.output === "number" ? tokensObj.output : undefined;

if (responseText) {
  await post("/api/assistant-response", {
    taskId:    state.taskId,
    sessionId: state.monitorSessionId,
    messageId: completion.messageId,
    source:    "opencode-plugin",
    title:     ellipsize(responseText, 120),
    body:      responseText,
    metadata: {
      stopReason:    completion.finish ?? "stop",
      ...(inputTokens  != null ? { inputTokens }  : {}),
      ...(outputTokens != null ? { outputTokens } : {})
    }
  });
  // Note: cache token counts are available in tokensObj.cache but not captured
  // (OpenCode does not expose them in the same format as Claude Code)
}
// If responseText is empty, skip — do not post an empty assistant-response event
```

**Post failure handling:** wrap the `post("/api/assistant-response", ...)` call in a try/catch. Log the error but do NOT rethrow — `finalizeSession` must always complete regardless of response capture success.

Also fix similar body truncation patterns in `chat.message` and other handlers if found.

---

## Web UI

No new components. The `assistant.response` event renders as a standard timeline card in the `user` lane — the existing generic card mechanism handles any event kind. The resulting conversation flow in the timeline:

```
user lane: [user.message: "Fix the bug"] ... [assistant.response: "I'll fix the bug now..."]
```

No additional CSS or component changes required for v1. Visual grouping of Q/A pairs is out of scope.

---

## Testing

### Server endpoint tests (`packages/server/test/`)

New test file: `test/assistant-response.test.ts`
- `logAssistantResponse` records event with `kind = "assistant.response"`, `lane = "user"`
- Schema rejects missing `taskId`, `messageId`, `source`, `title`
- `sessionId` is optional — records event without it
- Body is optional — records event without body when omitted
- Metadata is merged with `messageId` and `source`

### Stop hook → `/api/assistant-response` integration tests (`packages/server/test/claude-hooks.test.ts`)

These tests follow the existing pattern in `claude-hooks.test.ts`: they send HTTP POST requests to the running server (not by importing the hook script directly). The tests verify server-side behavior triggered by the hook's payload shape.

- Stop hook payload with string transcript → posts with full response text as body
- Stop hook payload with array-of-blocks transcript → posts concatenated text blocks only
- Stop hook payload with missing `transcript` → posts with empty body, title = `"Response (end_turn)"`
- Stop hook payload with missing `usage` → posts without token metadata fields

### OpenCode plugin tests (`packages/server/test/opencode-monitor-plugin.test.ts`)

- `message.updated` with `parts` containing text → posts `assistant.response` before `finalizeSession`
- `message.updated` without `parts` (or empty `parts`) → skips assistant-response post, no error, `finalizeSession` still runs
- Token counts from `info.tokens` are included in metadata when present
- `post` failure for assistant-response → error is caught, `finalizeSession` still runs

---

## Error Handling

- `Stop` hook: any error → log + silent exit (no hook blocking Claude Code)
- OpenCode: response post failure → catch + log, do NOT fail `finalizeSession`
- Missing transcript / parts → post with empty body, no error
- Empty response text in OpenCode → skip posting entirely (no empty-body events)
- Server: Zod parse failure → 400 with validation details (same as all other routes)
- Server: task not found (`requireTask` throws) → server error response (consistent with all other event routes). The hook's top-level catch handles this as a non-blocking error and logs it without blocking Claude Code.
