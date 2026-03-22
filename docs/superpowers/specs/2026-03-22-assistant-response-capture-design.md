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

Extract: last `{ role: "assistant" }` entry from `transcript` as `body`. If `transcript` is absent or has no assistant entry, send with empty body and `title = "Response (${stopReason})"`.

### OpenCode — `message.updated` event

Already handled in `extractAssistantTurnCompletion`. The `event.properties` for `message.updated` also contains:

```json
{
  "info": { "role": "assistant", "id": "msg-1", "sessionID": "s1", "finish": "stop",
            "tokens": { "input": 1200, "output": 340 }, "time": { "created": 0, "completed": 1 } },
  "parts": [{ "type": "text", "text": "I'll fix the bug now..." }]
}
```

Extract text via existing `extractTextFromParts(asArray(properties.parts))`. Token counts from `info.tokens`.

---

## New Event Kind

### `packages/core/src/domain.ts`

Add to `MonitoringEventKind` union:
```typescript
| "assistant.response"
```

Add to `defaultLaneForEventKind`:
```typescript
case "assistant.response":
  return "user";
```

---

## Server Changes

### `packages/server/src/application/types.ts`

```typescript
export interface TaskAssistantResponseInput {
  readonly taskId: string;
  readonly sessionId: string;
  readonly messageId: string;
  readonly source: string;          // "claude-hook" | "opencode-plugin"
  readonly title: string;           // ellipsized first line (120 chars)
  readonly body?: string;           // full response text
  readonly metadata?: Record<string, unknown>;
  // metadata carries: stopReason, inputTokens, outputTokens, cacheReadTokens, cacheCreateTokens
}
```

### `packages/server/src/presentation/schemas.ts`

```typescript
export const assistantResponseSchema = z.object({
  taskId:    z.string().min(1),
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  source:    z.string().min(1),
  title:     z.string().min(1),
  body:      z.string().optional(),
  metadata:  z.record(z.unknown()).optional()
});
```

### `packages/server/src/application/monitor-service.ts`

New method:
```typescript
async logAssistantResponse(input: TaskAssistantResponseInput): Promise<RecordedEventEnvelope> {
  await this.requireTask(input.taskId);
  return this.recorder.record({
    taskId: input.taskId,
    kind: "assistant.response",
    title: input.title,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.body       ? { body: input.body }           : {}),
    metadata: {
      ...(input.metadata ?? {}),
      messageId: input.messageId,
      source:    input.source
    }
  });
}
```

### `packages/server/src/presentation/http/routes/event-routes.ts`

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
    .find((m): m is { role: string; content: string } =>
      typeof m === "object" && m !== null &&
      (m as Record<string, unknown>).role === "assistant"
    );
  const responseText = lastAssistant ? String(lastAssistant.content ?? "") : "";

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
      ...(usage?.input_tokens          != null ? { inputTokens:       usage.input_tokens }          : {}),
      ...(usage?.output_tokens         != null ? { outputTokens:      usage.output_tokens }         : {}),
      ...(usage?.cache_read_input_tokens    != null ? { cacheReadTokens:  usage.cache_read_input_tokens }    : {}),
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

Add `Stop` hook registration:
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
| `body: description ? \`${description}\n\n$ ${command.slice(0, 300)}\`` | `body: description ? \`${description}\n\n$ ${command}\`` |
| `body: \`Intent: ${description}\nAction: $ ${command.slice(0, 200)}\`` | `body: \`Intent: ${description}\nAction: $ ${command}\`` |
| `metadata: { command: command.slice(0, 200) }` | `metadata: { command }` |

Remove the `MAX_COMMAND_LENGTH` constant.

### Truncation fixes — `.claude/hooks/explore.ts`

| Before | After |
|--------|-------|
| `body = \`Web lookup: ${query.slice(0, 200)}\`` | `body = \`Web lookup: ${query}\`` |

### Truncation fixes — `.claude/hooks/common.ts`

`stringifyToolInput` default limit: `200` → `10000`.

---

## OpenCode Plugin Changes

### `.opencode/plugins/monitor.ts`

In the `message.updated` handler, after `extractAssistantTurnCompletion` returns successfully and before `finalizeSession`:

```typescript
// Extract response text from parts if available
const parts = Array.isArray(properties.parts) ? properties.parts : [];
const responseText = extractTextFromParts(parts);
const tokens = asObject(asObject(properties.info).tokens);
const inputTokens  = typeof tokens.input  === "number" ? tokens.input  : undefined;
const outputTokens = typeof tokens.output === "number" ? tokens.output : undefined;

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
}
```

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

### Server (`packages/server/test/`)

New test file: `test/assistant-response.test.ts`
- `logAssistantResponse` records event with `kind = "assistant.response"`, `lane = "user"`
- Schema rejects missing `taskId`, `sessionId`, `messageId`, `source`, `title`
- Body is optional — records event without body when omitted
- Metadata is merged with `messageId` and `source`

### Claude Code Hooks (`packages/server/test/claude-hooks.test.ts`)

- Stop hook posts to `/api/assistant-response` with `stopReason`, `title`, `body`
- Stop hook handles missing `transcript` → posts with empty body, title = `"Response (end_turn)"`
- Stop hook handles missing `usage` → posts without token metadata

### OpenCode Plugin (`packages/server/test/opencode-monitor-plugin.test.ts`)

- `message.updated` with `parts` containing text → posts `assistant.response` event
- `message.updated` without `parts` → skips assistant-response post (no error)
- Token counts from `info.tokens` are included in metadata when present

---

## Error Handling

- `Stop` hook: any error → log + silent exit (no hook blocking Claude Code)
- OpenCode: response post failure → log, do NOT fail `finalizeSession`
- Missing transcript / parts → post with empty body, no error
- Server: Zod parse failure → 400 with validation details (same as all other routes)
