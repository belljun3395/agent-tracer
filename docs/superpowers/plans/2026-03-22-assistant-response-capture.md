# Assistant Response Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track AI assistant responses as `assistant.response` timeline cards in the `user` lane, paired with `user.message` events to form a visible conversation unit, while removing artificial body/command truncation across all runtimes.

**Architecture:** New `"assistant.response"` event kind added atomically to `MonitoringEventKind` union + `defaultLaneForEventKind` switch in `core/domain.ts`. Server gains `TaskAssistantResponseInput` type, `assistantResponseSchema`, `logAssistantResponse` service method, and `/api/assistant-response` route. Claude Code gets a new `Stop` hook; OpenCode plugin emits the event in its existing `message.updated` handler.

**Tech Stack:** TypeScript, Zod, Hono/Express router, Vitest.

**Spec:** `docs/superpowers/specs/2026-03-22-assistant-response-capture-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/core/src/domain.ts` | Add `"assistant.response"` to `MonitoringEventKind` union + `defaultLaneForEventKind` switch |
| Modify | `packages/server/src/application/types.ts` | Add `TaskAssistantResponseInput` interface |
| Modify | `packages/server/src/presentation/schemas.ts` | Add `assistantResponseSchema` |
| Modify | `packages/server/src/application/monitor-service.ts` | Add `logAssistantResponse` method |
| Modify | `packages/server/src/presentation/http/routes/event-routes.ts` | Add `/api/assistant-response` route |
| Create | `packages/server/test/assistant-response.test.ts` | Unit + integration tests for new endpoint |
| Create | `.claude/hooks/stop.ts` | New Stop hook extracting last assistant turn from transcript |
| Modify | `.claude/settings.json` | Register `Stop` hook |
| Modify | `.claude/hooks/terminal.ts` | Remove 500/300/200 char truncation limits |
| Modify | `.claude/hooks/explore.ts` | Remove 200 char truncation on WebSearch/WebFetch body |
| Modify | `.claude/hooks/common.ts` | Raise `stringifyToolInput` default `maxValueLength` 200 → 10000 |
| Modify | `.opencode/plugins/monitor.ts` | Add `ellipsize` helper; emit `assistant.response` in `message.updated` handler |
| Modify | `packages/server/test/claude-hooks.test.ts` | Add Stop hook integration tests |
| Modify | `packages/server/test/opencode-monitor-plugin.test.ts` | Add `message.updated` assistant-response tests |

---

## Task 1: Add `"assistant.response"` event kind to core domain (PREREQUISITE)

**⚠️ This task MUST be committed before any other task. Every file that references `kind: "assistant.response"` will fail TypeScript compilation until this lands.**

**Files:**
- Modify: `packages/core/src/domain.ts:41-57` (MonitoringEventKind union)
- Modify: `packages/core/src/domain.ts:175-203` (defaultLaneForEventKind switch)

Both edits are a single atomic change — the switch has no `default` branch and TypeScript enforces exhaustiveness, so adding the union member without the switch case causes a compile error across the entire monorepo.

- [ ] **Step 1: Edit `packages/core/src/domain.ts` — add to union**

In the `MonitoringEventKind` union (currently ends at line 57 with `"todo.logged"`), append `| "assistant.response"` as the last member:

```typescript
export type MonitoringEventKind =
  | "task.start"
  | "task.complete"
  | "task.error"
  | "plan.logged"
  | "action.logged"
  | "agent.activity.logged"
  | "verification.logged"
  | "rule.logged"
  | "tool.used"
  | "terminal.command"
  | "context.saved"
  | "file.changed"
  | "thought.logged"
  | "user.message"
  | "question.logged"
  | "todo.logged"
  | "assistant.response";
```

- [ ] **Step 2: Edit `packages/core/src/domain.ts` — add switch case**

In `defaultLaneForEventKind`, add a new case before the closing brace of the switch. The switch currently ends at `case "todo.logged": return "todos";`. Add after it:

```typescript
case "assistant.response":
  return "user";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0` (no errors)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/domain.ts
git commit -m "feat: add assistant.response event kind to core domain"
```

---

## Task 2: Server layer — type, schema, service method, route

**⚠️ Requires Task 1 to be committed first.**

**Files:**
- Modify: `packages/server/src/application/types.ts` (add `TaskAssistantResponseInput`)
- Modify: `packages/server/src/presentation/schemas.ts` (add `assistantResponseSchema`)
- Modify: `packages/server/src/application/monitor-service.ts` (add `logAssistantResponse`)
- Modify: `packages/server/src/presentation/http/routes/event-routes.ts` (add route)
- Create: `packages/server/test/assistant-response.test.ts` (tests)

### Step 1: Write failing tests

- [ ] **Create `packages/server/test/assistant-response.test.ts`**

Look at `packages/server/test/setup-external.test.ts` to understand the test setup pattern before writing. The tests hit a running server instance (not unit-mocking the service). Here is the full test file:

```typescript
import { describe, expect, it } from "vitest";
import { setupExternalServer } from "./setup-external.js";

const { getServer } = setupExternalServer();

describe("POST /api/assistant-response", () => {
  it("records event with kind=assistant.response and lane=user", async () => {
    const { port, client } = getServer();

    // Create a task first
    const taskRes = await client.post("/api/task-start", {
      title: "Test assistant response"
    });
    const { task } = taskRes;

    const res = await client.post("/api/assistant-response", {
      taskId: task.id,
      messageId: "msg-001",
      source: "claude-hook",
      title: "I'll fix the bug now",
      body: "I'll fix the bug now by editing the relevant file.",
      metadata: { stopReason: "end_turn", inputTokens: 100, outputTokens: 50 }
    });

    expect(res.events).toHaveLength(1);
    expect(res.events[0].kind).toBe("assistant.response");
  });

  it("records event in user lane", async () => {
    const { client } = getServer();

    const taskRes = await client.post("/api/task-start", { title: "Lane test" });
    const { task } = taskRes;

    const res = await client.post("/api/assistant-response", {
      taskId: task.id,
      messageId: "msg-002",
      source: "claude-hook",
      title: "Test response"
    });

    expect(res.events[0].kind).toBe("assistant.response");
  });

  it("records event without body when body is omitted", async () => {
    const { client } = getServer();

    const taskRes = await client.post("/api/task-start", { title: "No-body test" });
    const { task } = taskRes;

    const res = await client.post("/api/assistant-response", {
      taskId: task.id,
      messageId: "msg-003",
      source: "claude-hook",
      title: "Response (end_turn)"
      // body intentionally omitted
    });

    expect(res.events).toHaveLength(1);
    expect(res.events[0].kind).toBe("assistant.response");
  });

  it("records event without sessionId when sessionId is omitted", async () => {
    const { client } = getServer();

    const taskRes = await client.post("/api/task-start", { title: "No-session test" });
    const { task } = taskRes;

    const res = await client.post("/api/assistant-response", {
      taskId: task.id,
      messageId: "msg-004",
      source: "opencode-plugin",
      title: "Some response"
      // sessionId intentionally omitted
    });

    expect(res.events).toHaveLength(1);
  });

  it("merges messageId and source into metadata", async () => {
    const { client } = getServer();

    const taskRes = await client.post("/api/task-start", { title: "Metadata test" });
    const { task } = taskRes;

    await client.post("/api/assistant-response", {
      taskId: task.id,
      messageId: "msg-meta-001",
      source: "opencode-plugin",
      title: "Metadata test response",
      metadata: { stopReason: "stop", outputTokens: 200 }
    });
    // If we get here without error, metadata was accepted
  });

  it("rejects missing taskId with 400", async () => {
    const { port } = getServer();

    const res = await fetch(`http://127.0.0.1:${port}/api/assistant-response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "x", source: "test", title: "t" })
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing messageId with 400", async () => {
    const { port } = getServer();

    const res = await fetch(`http://127.0.0.1:${port}/api/assistant-response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: "t", source: "test", title: "t" })
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing title with 400", async () => {
    const { port } = getServer();

    const res = await fetch(`http://127.0.0.1:${port}/api/assistant-response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: "t", messageId: "m", source: "test" })
    });

    expect(res.status).toBe(400);
  });
});
```

Before writing the test, read `packages/server/test/setup-external.test.ts` to understand what `setupExternalServer` and `client` provide. Adapt the test if the actual API shape differs from what's shown here.

- [ ] **Step 2: Run tests to confirm RED**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test -- --reporter=verbose 2>&1 | grep -A5 "assistant-response"
```

Expected: FAIL — route not found (404) or module import error.

### Step 3: Implement server layer

- [ ] **Step 3a: Add `TaskAssistantResponseInput` to `packages/server/src/application/types.ts`**

Add at the end of the file (after `TaskSearchInput`):

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

- [ ] **Step 3b: Add `assistantResponseSchema` to `packages/server/src/presentation/schemas.ts`**

Add at the end of the file:

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

- [ ] **Step 3c: Add `logAssistantResponse` to `packages/server/src/application/monitor-service.ts`**

1. Add `TaskAssistantResponseInput` to the existing named import from `./types.js` (look at the import block at lines 14-22 — add `TaskAssistantResponseInput` to the list).

2. Add the new method after `logUserMessage` (around line 107). Use the existing `requireTask` + `recorder.record` pattern:

```typescript
async logAssistantResponse(input: TaskAssistantResponseInput): Promise<RecordedEventEnvelope> {
  const task = await this.requireTask(input.taskId);
  const event = await this.recorder.record({
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
  return { task, ...(input.sessionId ? { sessionId: input.sessionId } : {}), events: [{ id: event.id, kind: event.kind }] };
}
```

- [ ] **Step 3d: Add route to `packages/server/src/presentation/http/routes/event-routes.ts`**

1. Add `assistantResponseSchema` to the schema import block (lines 25-38):
   ```typescript
   import {
     // ... existing imports ...
     assistantResponseSchema
   } from "../../schemas.js";
   ```

2. Add `TaskAssistantResponseInput` to the types import block (lines 8-23):
   ```typescript
   import type {
     // ... existing imports ...
     TaskAssistantResponseInput
   } from "../../../application/types.js";
   ```

3. Add the route inside `createEventRoutes()`, before `return router;` (line 99):
   ```typescript
   router.post("/api/assistant-response", async (req, res) => {
     res.json(
       await service.logAssistantResponse(
         assistantResponseSchema.parse(req.body) as TaskAssistantResponseInput
       )
     );
   });
   ```

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test -- --reporter=verbose 2>&1 | grep -E "assistant-response|✓|✗|passed|failed"
```

Expected: all 8 new tests pass.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/application/types.ts packages/server/src/presentation/schemas.ts packages/server/src/application/monitor-service.ts packages/server/src/presentation/http/routes/event-routes.ts packages/server/test/assistant-response.test.ts
git commit -m "feat: add logAssistantResponse service method and /api/assistant-response route"
```

---

## Task 3: Claude Code Stop hook + settings

**⚠️ Requires Task 2 (server route) to be committed first — the hook posts to `/api/assistant-response`.**

**Files:**
- Create: `.claude/hooks/stop.ts`
- Modify: `.claude/settings.json`

The Stop hook fires after every assistant turn. The payload has `session_id`, `stop_reason`, `transcript` (array of `{role, content}` objects), and `usage` (token counts). The `content` field may be a plain string OR an array of content blocks (common in tool-use turns) — the hook must handle both.

### Step 1: Write failing tests

- [ ] **Add Stop hook tests to `packages/server/test/claude-hooks.test.ts`**

Add the following to the existing `claude-hooks.test.ts` file, after the existing test for terminal hook. First add the `stopHook` file reference alongside the other hook constants at the top (after `toolUsedHook`):

```typescript
const stopHook = fileURLToPath(new URL("../../../.claude/hooks/stop.ts", import.meta.url));
```

Then add to the `describe("Claude hooks")` block:

```typescript
it("Stop hook with string transcript posts assistant-response with full text", async () => {
  const monitor = await startMonitorStub();
  servers.push(monitor);

  await runClaudeHook(stopHook, {
    session_id: "parent-session",
    stop_reason: "end_turn",
    transcript: [
      { role: "user", content: "Fix the bug" },
      { role: "assistant", content: "I'll fix the bug by editing the file." }
    ],
    usage: { input_tokens: 100, output_tokens: 40 }
  }, monitor.port);

  const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
  expect(response).toBeDefined();
  expect(response!.body.source).toBe("claude-hook");
  expect(response!.body.body).toBe("I'll fix the bug by editing the file.");
  expect(response!.body.title).toBe("I'll fix the bug by editing the file.");
  expect(response!.body.metadata).toMatchObject({ stopReason: "end_turn", inputTokens: 100, outputTokens: 40 });
});

it("Stop hook with array-of-blocks transcript posts concatenated text", async () => {
  const monitor = await startMonitorStub();
  servers.push(monitor);

  await runClaudeHook(stopHook, {
    session_id: "parent-session",
    stop_reason: "end_turn",
    transcript: [
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: [
        { type: "tool_use", id: "t1", name: "bash", input: {} },
        { type: "text", text: "The answer is 4." }
      ]}
    ]
  }, monitor.port);

  const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
  expect(response).toBeDefined();
  expect(response!.body.body).toBe("The answer is 4.");
});

it("Stop hook with missing transcript posts with empty body and fallback title", async () => {
  const monitor = await startMonitorStub();
  servers.push(monitor);

  await runClaudeHook(stopHook, {
    session_id: "parent-session",
    stop_reason: "max_turns"
    // no transcript
  }, monitor.port);

  const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
  expect(response).toBeDefined();
  expect(response!.body.body).toBeUndefined();
  expect(response!.body.title).toBe("Response (max_turns)");
});

it("Stop hook with missing usage posts without token metadata fields", async () => {
  const monitor = await startMonitorStub();
  servers.push(monitor);

  await runClaudeHook(stopHook, {
    session_id: "parent-session",
    stop_reason: "end_turn",
    transcript: [
      { role: "assistant", content: "Done." }
    ]
    // no usage
  }, monitor.port);

  const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
  expect(response).toBeDefined();
  expect(response!.body.metadata).not.toHaveProperty("inputTokens");
  expect(response!.body.metadata).not.toHaveProperty("outputTokens");
});
```

- [ ] **Step 2: Run tests to confirm RED**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test -- --reporter=verbose 2>&1 | grep -A3 "Stop hook"
```

Expected: FAIL — hook file not found.

### Step 3: Implement the hook

- [ ] **Step 3a: Create `.claude/hooks/stop.ts`**

Look at `.claude/hooks/session_end.ts` and `.claude/hooks/user_prompt.ts` for the top-level structure pattern. Create the file:

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

**Before writing:** Check that `createMessageId`, `ellipsize`, `getSessionId`, `hookLogPayload`, `hookLog`, `toTrimmedString`, `ensureRuntimeSession`, `postJson`, and `readStdinJson` are all exported from `.claude/hooks/common.ts`. If `createMessageId` or `ellipsize` are missing, look at how they are used in other hook files to find the correct export name — and adjust the import accordingly.

- [ ] **Step 3b: Register the Stop hook in `.claude/settings.json`**

Inside the `"hooks"` object, add a new `"Stop"` key alongside `"SessionEnd"`. The `"Stop"` event does not use a `matcher` field — it runs unconditionally:

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

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test -- --reporter=verbose 2>&1 | grep -E "Stop hook|✓|✗|passed|failed"
```

Expected: all 4 new Stop hook tests pass, existing tests unaffected.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/stop.ts .claude/settings.json
git commit -m "feat: add Stop hook to capture assistant responses as timeline cards"
```

---

## Task 4: Remove body/command truncation in Claude Code hooks

**This task is independent of Tasks 2, 3 — can be done right after Task 1.**

**Files:**
- Modify: `.claude/hooks/terminal.ts`
- Modify: `.claude/hooks/explore.ts`
- Modify: `.claude/hooks/common.ts`

No new tests needed — existing tests continue to pass. Truncation removal does not change observable behavior for the test suite (tests use short inputs).

- [ ] **Step 1: Fix `terminal.ts`**

Current file has `const MAX_COMMAND_LENGTH = 500;` on line 13, and three truncation calls on lines 36, 38, 53:

1. Delete the `const MAX_COMMAND_LENGTH = 500;` line entirely.
2. Change `command: command.slice(0, MAX_COMMAND_LENGTH)` → `command: command`
3. Change `body: description ? \`${description}\n\n$ ${command.slice(0, 300)}\`` → `body: description ? \`${description}\n\n$ ${command}\``
4. Change `` body: `Intent: ${description}\nAction: $ ${command.slice(0, 200)}` `` → `` body: `Intent: ${description}\nAction: $ ${command}` ``
5. Change `metadata: { description }` — the `command.slice(0, 200)` was in the metadata of the second `postJson` call. Change `command: command.slice(0, 200)` → `command` (using shorthand).

After editing, re-read the file to confirm all five occurrences are fixed.

- [ ] **Step 2: Fix `explore.ts`**

On line 57, change:
```typescript
body = `Web lookup: ${query.slice(0, 200)}`;
```
to:
```typescript
body = `Web lookup: ${query}`;
```

- [ ] **Step 3: Fix `common.ts`**

Find the `stringifyToolInput` function. It has a `maxValueLength` parameter with a default value of `200`. Change the default to `10000`:

```typescript
// Before (approximate):
export function stringifyToolInput(input: Record<string, unknown>, maxValueLength = 200): string {

// After:
export function stringifyToolInput(input: Record<string, unknown>, maxValueLength = 10000): string {
```

Read the function first to find the exact signature line and change only the default value.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test 2>&1 | grep -E "Tests|passed|failed"
```

Expected: all existing tests still pass (no regressions).

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/terminal.ts .claude/hooks/explore.ts .claude/hooks/common.ts
git commit -m "fix: remove body/command truncation limits in Claude Code hooks"
```

---

## Task 5: OpenCode plugin — emit `assistant.response` in `message.updated` handler

**⚠️ Requires Task 2 (server route) to be committed first.**

**Files:**
- Modify: `.opencode/plugins/monitor.ts`
- Modify: `packages/server/test/opencode-monitor-plugin.test.ts`

The plugin is self-contained and does NOT import from Claude Code hooks — it gets its own local `ellipsize` helper.

### Step 1: Write failing tests

- [ ] **Add OpenCode plugin tests to `packages/server/test/opencode-monitor-plugin.test.ts`**

Read the existing test file first to understand its structure. Find the `message.updated` test section and add:

```typescript
it("message.updated with parts posts assistant.response before finalizeSession", async () => {
  // Find the existing session setup pattern in the file and replicate it
  // Then send a message.updated event with parts
  // Verify that /api/assistant-response is called BEFORE /api/session-end

  // The assistant.response call should have:
  // - source: "opencode-plugin"
  // - body: extracted text from parts
  // - title: ellipsized version of the text (<=120 chars)
  // - metadata.stopReason set from completion.finish

  // See existing tests in this file for the exact event payload format for message.updated
});

it("message.updated without parts skips assistant-response post", async () => {
  // Send message.updated with no parts field
  // Verify /api/assistant-response is NOT called
  // Verify finalizeSession still runs (/api/session-end or equivalent is called)
});

it("message.updated includes token counts in assistant-response metadata when present", async () => {
  // Send message.updated with info.tokens.input and info.tokens.output
  // Verify metadata.inputTokens and metadata.outputTokens are set
});

it("message.updated: post failure for assistant-response is caught; finalizeSession still runs", async () => {
  // Simulate /api/assistant-response returning a 500 error from the stub server
  // Verify that /api/session-end (or the finalize call) is still made despite the failure
  // This tests the try/catch non-fatal behavior in Step 3c
});
```

**Important:** Read the existing `opencode-monitor-plugin.test.ts` file completely before writing tests. Understand how the stub server is set up, how events are posted to the plugin, and what the existing `message.updated` tests look like. Match those exact patterns.

- [ ] **Step 2: Run tests to confirm RED**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test -- opencode-monitor-plugin --reporter=verbose 2>&1 | grep -A5 "assistant.response\|message.updated"
```

Expected: FAIL — plugin does not yet post to `/api/assistant-response`.

### Step 3: Implement OpenCode plugin changes

- [ ] **Step 3a: Read `.opencode/plugins/monitor.ts`** to find:
  - Where `pluginLog` and `toNonEmptyString` helpers are defined (add `ellipsize` alongside them)
  - Where `extractAssistantTurnCompletion` is called in the `message.updated` handler
  - Where `finalizeSession` is called in the `message.updated` handler
  - How `asObject` is used (used to safely access nested objects)
  - How `post` is called (the HTTP client function)

- [ ] **Step 3b: Add `ellipsize` helper**

After the existing `pluginLog` and `toNonEmptyString` helper functions (wherever they are), add:

```typescript
function ellipsize(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
```

- [ ] **Step 3c: Add assistant-response emit to `message.updated` handler**

Find the section in `message.updated` where `extractAssistantTurnCompletion` returns successfully, and before `finalizeSession` is called, insert:

```typescript
// Extract response text from parts if available
const parts = Array.isArray(properties.parts) ? properties.parts : [];
const responseText = extractTextFromParts(parts);
const tokensObj = asObject(asObject(properties.info).tokens);
const inputTokens  = typeof tokensObj.input  === "number" ? tokensObj.input  : undefined;
const outputTokens = typeof tokensObj.output === "number" ? tokensObj.output : undefined;

if (responseText) {
  try {
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
  } catch (err: unknown) {
    pluginLog("message.updated", "assistant-response post failed (non-fatal)", { error: String(err) });
    // Do NOT rethrow — finalizeSession must always complete
  }
}
// If responseText is empty, skip — do not post an empty assistant-response event
```

The `try/catch` is critical: a failure posting the response card must NOT prevent `finalizeSession` from running.

**Variable name check:** `state.monitorSessionId` and `state.taskId` are assumed here. Read the plugin to confirm the actual field names and adjust accordingly.

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test -- opencode-monitor-plugin --reporter=verbose 2>&1 | grep -E "✓|✗|passed|failed"
```

Expected: all new tests pass, existing tests unaffected.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test 2>&1 | grep -E "Tests|passed|failed"
```

Expected: all tests pass.

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 7: Commit**

```bash
git add .opencode/plugins/monitor.ts packages/server/test/opencode-monitor-plugin.test.ts
git commit -m "feat: emit assistant.response in OpenCode message.updated handler"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm run test 2>&1 | grep -E "Tests|passed|failed"
```

Expected: all tests pass (server + web packages).

- [ ] **Verify TypeScript across monorepo**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Smoke-test in dev**

Start the dev server and trigger a Claude Code session. After an assistant turn completes:
- Verify a card appears in the `user` lane with `assistant.response` kind
- Verify the card body contains the full response text (not truncated)
- Verify the card title is the ellipsized first line (≤ 120 chars)
- Verify no empty `assistant.response` cards appear (pure tool-use turns)
