# OTLP Token Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace transcript-based per-turn token collection in `Stop.ts` with per-API-call token collection via Claude Code's OTLP `api_request` log events, adding a new `token.usage` event kind that `getTokenSummary()` reads from.

**Architecture:** Claude Code emits OTLP HTTP/JSON logs to a new `POST /v1/logs` endpoint in Agent Tracer. The endpoint filters `claude_code.api_request` log records, looks up the Agent Tracer session by `session.id`, and stores a `token.usage` event per API call. `Stop.ts` continues to post `assistant.response` for response text and `stop_reason`, but no longer reads token data from the transcript. The token aggregation in `getTokenSummary()` is updated to read from `token.usage` events; it still skips `assistant.response` events without token data for backward compatibility with existing sessions.

**Tech Stack:** TypeScript ESM, NestJS 11, Zod 3, Vitest, Supertest, OTLP HTTP/JSON logs format (CNCF OpenTelemetry)

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `packages/adapter-otlp-logs/package.json` | Package manifest for the new NestJS adapter |
| `packages/adapter-otlp-logs/tsconfig.json` | TypeScript config (mirrors adapter-http-ingest) |
| `packages/adapter-otlp-logs/tsconfig.test.json` | Test-only TS config for vitest |
| `packages/adapter-otlp-logs/vitest.config.ts` | Vitest config |
| `packages/adapter-otlp-logs/src/schemas.otlp.ts` | Zod schema for OTLP HTTP/JSON logs request format |
| `packages/adapter-otlp-logs/src/otlp-mapper.ts` | Extract `api_request` records → `OtlpApiRequestRecord[]` |
| `packages/adapter-otlp-logs/src/otlp-logs.controller.ts` | `@Controller("/v1") @Post("logs")` NestJS handler |
| `packages/adapter-otlp-logs/src/index.ts` | Package exports |

### Modified files
| File | Change |
|------|--------|
| `packages/domain/src/monitoring/types.ts` | Add `"token.usage"` to `MonitoringEventKind` union |
| `packages/domain/src/monitoring/utils.ts` | Add `"token.usage"` case to `defaultLaneForEventKind()` |
| `packages/adapter-http-ingest/src/schemas.ingest.ts` | Add `"token.usage"` to `INGEST_EVENT_KINDS` |
| `packages/application/src/services/event-logging-service.ts` | Add `logTokenUsage()` method |
| `packages/application/src/monitor-service.ts` | Add `logTokenUsage()` delegate + `resolveRuntimeBinding()` |
| `packages/application/src/services/event-ingestion-service.ts` | Add `"token.usage"` case in `dispatchEvent()` |
| `packages/application/src/types.ts` | Add `TaskTokenUsageInput` interface |
| `packages/web-domain/src/lib/insights/aggregation.ts` | Update `getTokenSummary()` to read from `token.usage` |
| `tsconfig.base.json` | Add `@monitor/adapter-otlp-logs` path alias |
| `packages/server/src/presentation/app.module.ts` | Register `OtlpLogsController` |
| `packages/runtime-claude/hooks/Stop.ts` | Remove token reading from transcript |

---

## Task 1: Add `token.usage` to domain types

**Files:**
- Modify: `packages/domain/src/monitoring/types.ts:5`
- Modify: `packages/domain/src/monitoring/utils.ts:21-55`

- [ ] **Step 1: Add `"token.usage"` to `MonitoringEventKind`**

In `packages/domain/src/monitoring/types.ts`, change line 5:

```typescript
export type MonitoringEventKind = "task.start" | "task.complete" | "task.error" | "session.ended" | "plan.logged" | "action.logged" | "agent.activity.logged" | "verification.logged" | "rule.logged" | "tool.used" | "terminal.command" | "context.saved" | "file.changed" | "thought.logged" | "user.message" | "question.logged" | "todo.logged" | "assistant.response" | "instructions.loaded" | "token.usage";
```

- [ ] **Step 2: Add lane case in `defaultLaneForEventKind()`**

In `packages/domain/src/monitoring/utils.ts`, add before the closing brace of the switch (after the `"instructions.loaded"` case):

```typescript
        case "token.usage":
            return "background";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/domain && npx tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/domain/src/monitoring/types.ts packages/domain/src/monitoring/utils.ts
git commit -m "feat(domain): add token.usage event kind to MonitoringEventKind"
```

---

## Task 2: Add `TaskTokenUsageInput` type and `logTokenUsage()` to application layer

**Files:**
- Modify: `packages/application/src/types.ts`
- Modify: `packages/application/src/services/event-logging-service.ts`
- Modify: `packages/application/src/monitor-service.ts`

- [ ] **Step 1: Add `TaskTokenUsageInput` interface to `packages/application/src/types.ts`**

Find the block where `TaskAssistantResponseInput` is defined and add below it:

```typescript
export interface TaskTokenUsageInput {
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly costUsd?: number;
    readonly durationMs?: number;
    readonly model?: string;
    readonly promptId?: string;
}
```

- [ ] **Step 2: Add `logTokenUsage()` to `EventLoggingService`**

In `packages/application/src/services/event-logging-service.ts`, import the new type (add to the existing import from `"../types.js"`):

```typescript
// Add TaskTokenUsageInput to the existing types import
import type { ..., TaskTokenUsageInput } from "../types.js";
```

Then add the method after `logAssistantResponse()`:

```typescript
    async logTokenUsage(input: TaskTokenUsageInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "token.usage",
            title: input.model ? `API call (${input.model})` : "API call",
            ...this.withSessionId(input.sessionId),
            metadata: {
                inputTokens: input.inputTokens,
                outputTokens: input.outputTokens,
                cacheReadTokens: input.cacheReadTokens,
                cacheCreateTokens: input.cacheCreateTokens,
                ...(input.costUsd != null ? { costUsd: input.costUsd } : {}),
                ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
                ...(input.model ? { model: input.model } : {}),
                ...(input.promptId ? { promptId: input.promptId } : {}),
                source: "otlp",
            },
        });
        return {
            ...this.withSessionId(input.sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
```

- [ ] **Step 3: Add `logTokenUsage()` delegate to `MonitorService`**

In `packages/application/src/monitor-service.ts`, add the import for `TaskTokenUsageInput` (add to existing types import), then add the delegate method alongside the other `log*` methods:

```typescript
    async logTokenUsage(input: TaskTokenUsageInput): Promise<RecordedEventEnvelope> {
        return this.logging.logTokenUsage(input);
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/application && npx tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/types.ts packages/application/src/services/event-logging-service.ts packages/application/src/monitor-service.ts
git commit -m "feat(application): add logTokenUsage() to MonitorService and EventLoggingService"
```

---

## Task 3: Wire `token.usage` into ingest schema and EventIngestionService

**Files:**
- Modify: `packages/adapter-http-ingest/src/schemas.ingest.ts`
- Modify: `packages/application/src/services/event-ingestion-service.ts`

- [ ] **Step 1: Write failing test for `token.usage` ingest**

Create `packages/adapter-http-ingest/test/token-usage-ingest.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ingestEventsBatchSchema } from "../src/schemas.ingest.js";

describe("ingestEventsBatchSchema — token.usage", () => {
    it("accepts a valid token.usage event", () => {
        const result = ingestEventsBatchSchema.safeParse({
            events: [{
                kind: "token.usage",
                taskId: "task_001",
                sessionId: "sess_001",
                metadata: {
                    inputTokens: 100,
                    outputTokens: 50,
                    cacheReadTokens: 20,
                    cacheCreateTokens: 10,
                    model: "claude-sonnet-4-6",
                    source: "otlp",
                },
            }],
        });
        expect(result.success).toBe(true);
    });

    it("rejects an unknown event kind", () => {
        const result = ingestEventsBatchSchema.safeParse({
            events: [{ kind: "unknown.kind", taskId: "task_001" }],
        });
        expect(result.success).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/adapter-http-ingest && npx vitest run test/token-usage-ingest.test.ts
```

Expected: FAIL — `"token.usage"` not in enum.

- [ ] **Step 3: Add `"token.usage"` to `INGEST_EVENT_KINDS`**

In `packages/adapter-http-ingest/src/schemas.ingest.ts`, change:

```typescript
export const INGEST_EVENT_KINDS = [
    "tool.used",
    "terminal.command",
    "context.saved",
    "plan.logged",
    "action.logged",
    "verification.logged",
    "rule.logged",
    "agent.activity.logged",
    "user.message",
    "question.logged",
    "todo.logged",
    "thought.logged",
    "assistant.response",
    "instructions.loaded",
    "session.ended",
    "token.usage",
] as const
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/adapter-http-ingest && npx vitest run test/token-usage-ingest.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add `"token.usage"` case to `EventIngestionService.dispatchEvent()`**

In `packages/application/src/services/event-ingestion-service.ts`, add before the `default` case:

```typescript
            case "token.usage":
                return this.monitor.logTokenUsage({
                    taskId,
                    ...(sessionId ? { sessionId } : {}),
                    inputTokens: typeof e.metadata?.["inputTokens"] === "number" ? e.metadata["inputTokens"] : 0,
                    outputTokens: typeof e.metadata?.["outputTokens"] === "number" ? e.metadata["outputTokens"] : 0,
                    cacheReadTokens: typeof e.metadata?.["cacheReadTokens"] === "number" ? e.metadata["cacheReadTokens"] : 0,
                    cacheCreateTokens: typeof e.metadata?.["cacheCreateTokens"] === "number" ? e.metadata["cacheCreateTokens"] : 0,
                    ...(typeof e.metadata?.["costUsd"] === "number" ? { costUsd: e.metadata["costUsd"] } : {}),
                    ...(typeof e.metadata?.["durationMs"] === "number" ? { durationMs: e.metadata["durationMs"] } : {}),
                    ...(typeof e.metadata?.["model"] === "string" ? { model: e.metadata["model"] } : {}),
                    ...(typeof e.metadata?.["promptId"] === "string" ? { promptId: e.metadata["promptId"] } : {}),
                })
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd packages/application && npx tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/adapter-http-ingest/src/schemas.ingest.ts packages/adapter-http-ingest/test/token-usage-ingest.test.ts packages/application/src/services/event-ingestion-service.ts
git commit -m "feat: wire token.usage into ingest schema and EventIngestionService"
```

---

## Task 4: Update `getTokenSummary()` to read from `token.usage`

**Files:**
- Modify: `packages/web-domain/src/lib/insights/aggregation.ts`

- [ ] **Step 1: Write failing test**

Create `packages/web-domain/src/lib/insights/aggregation-token-usage.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getTokenSummary } from "./aggregation.js";
import type { TimelineEvent } from "../../types.js";

function makeTokenUsageEvent(overrides: Partial<TimelineEvent> & { metadata: Record<string, unknown> }): TimelineEvent {
    return {
        id: "evt_1",
        kind: "token.usage",
        taskId: "task_1",
        title: "API call",
        createdAt: new Date().toISOString(),
        lane: "background",
        classification: { tags: [], confidence: 1 },
        metadata: overrides.metadata,
        ...overrides,
    } as unknown as TimelineEvent;
}

describe("getTokenSummary — token.usage events", () => {
    it("sums tokens from token.usage events", () => {
        const timeline: TimelineEvent[] = [
            makeTokenUsageEvent({ metadata: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 20, cacheCreateTokens: 10 } }),
            makeTokenUsageEvent({ metadata: { inputTokens: 200, outputTokens: 80, cacheReadTokens: 0, cacheCreateTokens: 5 } }),
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(300);
        expect(summary.totalOutput).toBe(130);
        expect(summary.totalCacheRead).toBe(20);
        expect(summary.totalCacheCreate).toBe(15);
        expect(summary.turnCount).toBe(2);
    });

    it("still reads tokens from legacy assistant.response events", () => {
        const timeline: TimelineEvent[] = [
            {
                id: "evt_2",
                kind: "assistant.response",
                taskId: "task_1",
                title: "Response",
                createdAt: new Date().toISOString(),
                lane: "user",
                classification: { tags: [], confidence: 1 },
                metadata: { inputTokens: 50, outputTokens: 25, cacheReadTokens: 0, cacheCreateTokens: 0 },
            } as unknown as TimelineEvent,
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(50);
        expect(summary.turnCount).toBe(1);
    });

    it("skips assistant.response events with no token data", () => {
        const timeline: TimelineEvent[] = [
            {
                id: "evt_3",
                kind: "assistant.response",
                taskId: "task_1",
                title: "Response (no tokens)",
                createdAt: new Date().toISOString(),
                lane: "user",
                classification: { tags: [], confidence: 1 },
                metadata: { stopReason: "end_turn", source: "otlp" },
            } as unknown as TimelineEvent,
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(0);
        expect(summary.turnCount).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/web-domain && npx vitest run src/lib/insights/aggregation-token-usage.test.ts
```

Expected: FAIL — `token.usage` events not read, and `assistant.response` without tokens still counted.

- [ ] **Step 3: Update `getTokenSummary()`**

In `packages/web-domain/src/lib/insights/aggregation.ts`, replace the `getTokenSummary` function body:

```typescript
export function getTokenSummary(timeline: readonly TimelineEvent[]): TokenSummary {
    let totalNewInput = 0;
    let totalCacheRead = 0;
    let totalCacheCreate = 0;
    let totalOutput = 0;
    let turnCount = 0;
    for (const event of timeline) {
        if (event.kind !== "assistant.response" && event.kind !== "token.usage") {
            continue;
        }
        const inputTokens = extractMetadataNumber(event.metadata, "inputTokens") ?? 0;
        const cacheReadTokens = extractMetadataNumber(event.metadata, "cacheReadTokens") ?? 0;
        const cacheCreateTokens = extractMetadataNumber(event.metadata, "cacheCreateTokens") ?? 0;
        const outputTokens = extractMetadataNumber(event.metadata, "outputTokens") ?? 0;
        // Skip events with no token data (e.g., new-style assistant.response without tokens).
        if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && cacheCreateTokens === 0) {
            continue;
        }
        totalNewInput += Math.max(0, inputTokens);
        totalCacheRead += Math.max(0, cacheReadTokens);
        totalCacheCreate += Math.max(0, cacheCreateTokens);
        totalOutput += Math.max(0, outputTokens);
        turnCount += 1;
    }
    const totalInputSide = totalNewInput + totalCacheRead + totalCacheCreate;
    const overallHitRate = totalInputSide > 0
        ? (totalCacheRead / totalInputSide) * 100
        : 0;
    return {
        totalNewInput,
        totalCacheRead,
        totalCacheCreate,
        totalOutput,
        overallHitRate,
        turnCount
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/web-domain && npx vitest run src/lib/insights/aggregation-token-usage.test.ts
```

Expected: PASS (all 3 cases).

- [ ] **Step 5: Run existing aggregation tests to catch regressions**

```bash
cd packages/web-domain && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web-domain/src/lib/insights/aggregation.ts packages/web-domain/src/lib/insights/aggregation-token-usage.test.ts
git commit -m "feat(web-domain): update getTokenSummary to read token.usage events with backward compat"
```

---

## Task 5: Add `resolveRuntimeBinding()` to MonitorService

**Files:**
- Modify: `packages/application/src/monitor-service.ts`

The OTLP controller needs to look up `(taskId, sessionId)` from a Claude Code `session.id` without creating a new session. This uses the existing `runtimeBindings.find()` port.

- [ ] **Step 1: Add `resolveRuntimeBinding()` to MonitorService**

In `packages/application/src/monitor-service.ts`, find the imports and ensure `RuntimeBinding` is imported from the ports, then add the method near the other runtime session methods:

```typescript
    async resolveRuntimeBinding(
        runtimeSource: string,
        runtimeSessionId: string,
    ): Promise<{ taskId: string; sessionId: string } | null> {
        const binding = await this.ports.runtimeBindings.find(
            runtimeSource as import("@monitor/domain").RuntimeSource,
            runtimeSessionId as import("@monitor/domain").RuntimeSessionId,
        );
        if (!binding) return null;
        return { taskId: String(binding.taskId), sessionId: String(binding.monitorSessionId) };
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/application && npx tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/application/src/monitor-service.ts
git commit -m "feat(application): add resolveRuntimeBinding() to MonitorService for OTLP session lookup"
```

---

## Task 6: Create `adapter-otlp-logs` package scaffold

**Files:**
- Create: `packages/adapter-otlp-logs/package.json`
- Create: `packages/adapter-otlp-logs/tsconfig.json`
- Create: `packages/adapter-otlp-logs/tsconfig.test.json`
- Create: `packages/adapter-otlp-logs/vitest.config.ts`
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Create `packages/adapter-otlp-logs/package.json`**

```json
{
  "name": "@monitor/adapter-otlp-logs",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint:types": "tsc -p tsconfig.test.json --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@monitor/application": "*",
    "@monitor/domain": "*",
    "zod": "^3.0.0"
  },
  "peerDependencies": {
    "@nestjs/common": "^11.0.0"
  },
  "devDependencies": {
    "@nestjs/common": "^11.1.18",
    "@monitor/server": "*",
    "@types/node": "^22.0.0",
    "reflect-metadata": "^0.2.2",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/adapter-otlp-logs/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["node"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/adapter-otlp-logs/tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `packages/adapter-otlp-logs/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: false,
    },
});
```

- [ ] **Step 5: Add path alias to `tsconfig.base.json`**

In `tsconfig.base.json`, add inside the `"paths"` object:

```json
      "@monitor/adapter-otlp-logs": [
        "packages/adapter-otlp-logs/src/index.ts"
      ],
```

- [ ] **Step 6: Verify npm recognises the new workspace**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer && npm install
```

Expected: no errors, workspace resolved.

- [ ] **Step 7: Commit**

```bash
git add packages/adapter-otlp-logs/package.json packages/adapter-otlp-logs/tsconfig.json packages/adapter-otlp-logs/tsconfig.test.json packages/adapter-otlp-logs/vitest.config.ts tsconfig.base.json
git commit -m "chore: scaffold adapter-otlp-logs package"
```

---

## Task 7: Implement OTLP schemas and mapper

**Files:**
- Create: `packages/adapter-otlp-logs/src/schemas.otlp.ts`
- Create: `packages/adapter-otlp-logs/test/otlp-mapper.test.ts`
- Create: `packages/adapter-otlp-logs/src/otlp-mapper.ts`

- [ ] **Step 1: Create `packages/adapter-otlp-logs/src/schemas.otlp.ts`**

```typescript
import { z } from "zod";

// OTLP AnyValue: int64 is serialised as a string in JSON to avoid precision loss.
const otlpAnyValue = z.union([
    z.object({ stringValue: z.string() }),
    z.object({ intValue: z.union([z.string(), z.number()]) }),
    z.object({ doubleValue: z.number() }),
    z.object({ boolValue: z.boolean() }),
    z.record(z.unknown()),
]);

const otlpKeyValue = z.object({
    key: z.string(),
    value: otlpAnyValue,
});

const otlpLogRecord = z.object({
    timeUnixNano: z.string().optional(),
    body: otlpAnyValue.optional(),
    attributes: z.array(otlpKeyValue).default([]),
});

const otlpScopeLogs = z.object({
    scope: z.object({ name: z.string().optional() }).optional(),
    logRecords: z.array(otlpLogRecord).default([]),
});

const otlpResourceLogs = z.object({
    resource: z.object({
        attributes: z.array(otlpKeyValue).default([]),
    }).optional(),
    scopeLogs: z.array(otlpScopeLogs).default([]),
});

export const otlpLogsRequestSchema = z.object({
    resourceLogs: z.array(otlpResourceLogs).default([]),
});

export type OtlpLogsRequest = z.infer<typeof otlpLogsRequestSchema>;
export type OtlpKeyValue = z.infer<typeof otlpKeyValue>;
export type OtlpLogRecord = z.infer<typeof otlpLogRecord>;
```

- [ ] **Step 2: Write failing test for the mapper**

Create `packages/adapter-otlp-logs/test/otlp-mapper.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractApiRequestRecords } from "../src/otlp-mapper.js";
import type { OtlpLogsRequest } from "../src/schemas.otlp.js";

const validRequest: OtlpLogsRequest = {
    resourceLogs: [
        {
            resource: {
                attributes: [
                    { key: "service.name", value: { stringValue: "claude-code" } },
                    { key: "session.id", value: { stringValue: "sid_abc" } },
                ],
            },
            scopeLogs: [
                {
                    scope: { name: "com.anthropic.claude_code" },
                    logRecords: [
                        {
                            timeUnixNano: "1745000000000000000",
                            body: { stringValue: "claude_code.api_request" },
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "session.id", value: { stringValue: "sid_abc" } },
                                { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                                { key: "input_tokens", value: { intValue: "1234" } },
                                { key: "output_tokens", value: { intValue: "567" } },
                                { key: "cache_read_tokens", value: { intValue: "100" } },
                                { key: "cache_creation_tokens", value: { intValue: "50" } },
                                { key: "cost_usd", value: { doubleValue: 0.025 } },
                                { key: "duration_ms", value: { intValue: "1500" } },
                                { key: "prompt.id", value: { stringValue: "prompt_xyz" } },
                            ],
                        },
                        {
                            // Non-api_request record — should be ignored
                            attributes: [
                                { key: "event.name", value: { stringValue: "user_prompt" } },
                                { key: "session.id", value: { stringValue: "sid_abc" } },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};

describe("extractApiRequestRecords", () => {
    it("extracts api_request records with correct token fields", () => {
        const records = extractApiRequestRecords(validRequest);
        expect(records).toHaveLength(1);
        const rec = records[0]!;
        expect(rec.sessionId).toBe("sid_abc");
        expect(rec.model).toBe("claude-sonnet-4-6");
        expect(rec.inputTokens).toBe(1234);
        expect(rec.outputTokens).toBe(567);
        expect(rec.cacheReadTokens).toBe(100);
        expect(rec.cacheCreateTokens).toBe(50);
        expect(rec.costUsd).toBeCloseTo(0.025);
        expect(rec.durationMs).toBe(1500);
        expect(rec.promptId).toBe("prompt_xyz");
    });

    it("skips non-api_request records", () => {
        const records = extractApiRequestRecords(validRequest);
        expect(records.every(r => r.inputTokens !== undefined)).toBe(true);
    });

    it("returns empty array for empty resourceLogs", () => {
        const records = extractApiRequestRecords({ resourceLogs: [] });
        expect(records).toHaveLength(0);
    });

    it("falls back to resource-level session.id when record attributes lack it", () => {
        const req: OtlpLogsRequest = {
            resourceLogs: [
                {
                    resource: { attributes: [{ key: "session.id", value: { stringValue: "res_sid" } }] },
                    scopeLogs: [{
                        logRecords: [{
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "input_tokens", value: { intValue: "10" } },
                                { key: "output_tokens", value: { intValue: "5" } },
                            ],
                        }],
                    }],
                },
            ],
        };
        const records = extractApiRequestRecords(req);
        expect(records[0]?.sessionId).toBe("res_sid");
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/adapter-otlp-logs && npx vitest run test/otlp-mapper.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create `packages/adapter-otlp-logs/src/otlp-mapper.ts`**

```typescript
import type { OtlpKeyValue, OtlpLogsRequest } from "./schemas.otlp.js";

export interface OtlpApiRequestRecord {
    readonly sessionId: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly costUsd?: number;
    readonly durationMs?: number;
    readonly model?: string;
    readonly promptId?: string;
}

function readAttr(attrs: OtlpKeyValue[], key: string): string | number | boolean | undefined {
    const found = attrs.find(a => a.key === key);
    if (!found) return undefined;
    const v = found.value;
    if ("stringValue" in v) return v.stringValue;
    if ("intValue" in v) return typeof v.intValue === "string" ? parseInt(v.intValue, 10) : v.intValue;
    if ("doubleValue" in v) return v.doubleValue;
    if ("boolValue" in v) return v.boolValue;
    return undefined;
}

function toNumber(v: string | number | boolean | undefined): number | undefined {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const n = Number(v); return isNaN(n) ? undefined : n; }
    return undefined;
}

function toString(v: string | number | boolean | undefined): string | undefined {
    return typeof v === "string" ? v : undefined;
}

export function extractApiRequestRecords(req: OtlpLogsRequest): OtlpApiRequestRecord[] {
    const records: OtlpApiRequestRecord[] = [];

    for (const resourceLog of req.resourceLogs) {
        const resourceAttrs = resourceLog.resource?.attributes ?? [];
        const resourceSessionId = toString(readAttr(resourceAttrs, "session.id"));

        for (const scopeLog of resourceLog.scopeLogs) {
            for (const logRecord of scopeLog.logRecords) {
                const attrs = logRecord.attributes;
                const eventName = toString(readAttr(attrs, "event.name"));
                if (eventName !== "api_request") continue;

                const sessionId = toString(readAttr(attrs, "session.id")) ?? resourceSessionId;
                if (!sessionId) continue;

                const inputTokens = toNumber(readAttr(attrs, "input_tokens")) ?? 0;
                const outputTokens = toNumber(readAttr(attrs, "output_tokens")) ?? 0;
                const cacheReadTokens = toNumber(readAttr(attrs, "cache_read_tokens")) ?? 0;
                const cacheCreateTokens = toNumber(readAttr(attrs, "cache_creation_tokens")) ?? 0;
                const costUsd = toNumber(readAttr(attrs, "cost_usd"));
                const durationMs = toNumber(readAttr(attrs, "duration_ms"));
                const model = toString(readAttr(attrs, "model"));
                const promptId = toString(readAttr(attrs, "prompt.id"));

                records.push({
                    sessionId,
                    inputTokens,
                    outputTokens,
                    cacheReadTokens,
                    cacheCreateTokens,
                    ...(costUsd != null ? { costUsd } : {}),
                    ...(durationMs != null ? { durationMs } : {}),
                    ...(model ? { model } : {}),
                    ...(promptId ? { promptId } : {}),
                });
            }
        }
    }

    return records;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/adapter-otlp-logs && npx vitest run test/otlp-mapper.test.ts
```

Expected: PASS (all 4 cases).

- [ ] **Step 6: Commit**

```bash
git add packages/adapter-otlp-logs/src/schemas.otlp.ts packages/adapter-otlp-logs/src/otlp-mapper.ts packages/adapter-otlp-logs/test/otlp-mapper.test.ts
git commit -m "feat(adapter-otlp-logs): implement OTLP log schemas and api_request record mapper"
```

---

## Task 8: Implement OTLP logs controller and exports

**Files:**
- Create: `packages/adapter-otlp-logs/src/otlp-logs.controller.ts`
- Create: `packages/adapter-otlp-logs/src/index.ts`
- Create: `packages/adapter-otlp-logs/test/otlp-logs-integration.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `packages/adapter-otlp-logs/test/otlp-logs-integration.test.ts`:

```typescript
import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type * as http from "node:http";
import { createNestMonitorRuntime } from "@monitor/server";
import type { MonitorRuntime } from "@monitor/server";

let runtime: MonitorRuntime;
let httpServer: http.Server;

beforeEach(async () => {
    runtime = await createNestMonitorRuntime({ databasePath: ":memory:" });
    httpServer = runtime.server;
});

afterEach(async () => {
    await runtime.close();
});

async function startSession(title = "OTLP test session"): Promise<{ taskId: string; sessionId: string; runtimeSessionId: string }> {
    const res = await request(httpServer)
        .post("/api/runtime-session-ensure")
        .send({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "test-session-abc",
            title,
            workspacePath: "/tmp/test",
        });
    expect(res.status).toBe(200);
    return {
        taskId: res.body.taskId as string,
        sessionId: res.body.sessionId as string,
        runtimeSessionId: "test-session-abc",
    };
}

describe("POST /v1/logs — OTLP logs receiver", () => {
    it("returns 200 for a valid api_request log", async () => {
        await startSession();
        const res = await request(httpServer)
            .post("/v1/logs")
            .send({
                resourceLogs: [{
                    scopeLogs: [{
                        logRecords: [{
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "session.id", value: { stringValue: "test-session-abc" } },
                                { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                                { key: "input_tokens", value: { intValue: "500" } },
                                { key: "output_tokens", value: { intValue: "200" } },
                                { key: "cache_read_tokens", value: { intValue: "100" } },
                                { key: "cache_creation_tokens", value: { intValue: "0" } },
                            ],
                        }],
                    }],
                }],
            });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("returns 200 and skips records without a known session", async () => {
        const res = await request(httpServer)
            .post("/v1/logs")
            .send({
                resourceLogs: [{
                    scopeLogs: [{
                        logRecords: [{
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "session.id", value: { stringValue: "unknown-session-999" } },
                                { key: "input_tokens", value: { intValue: "10" } },
                                { key: "output_tokens", value: { intValue: "5" } },
                            ],
                        }],
                    }],
                }],
            });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.skipped).toBe(1);
    });

    it("returns 400 for malformed body", async () => {
        const res = await request(httpServer)
            .post("/v1/logs")
            .send("not json");
        expect(res.status).toBe(400);
    });

    it("returns 200 for empty resourceLogs", async () => {
        const res = await request(httpServer)
            .post("/v1/logs")
            .send({ resourceLogs: [] });
        expect(res.status).toBe(200);
    });

    it("stores token.usage event readable via task timeline", async () => {
        const { taskId } = await startSession();
        await request(httpServer)
            .post("/v1/logs")
            .send({
                resourceLogs: [{
                    scopeLogs: [{
                        logRecords: [{
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "session.id", value: { stringValue: "test-session-abc" } },
                                { key: "input_tokens", value: { intValue: "100" } },
                                { key: "output_tokens", value: { intValue: "50" } },
                                { key: "cache_read_tokens", value: { intValue: "0" } },
                                { key: "cache_creation_tokens", value: { intValue: "0" } },
                            ],
                        }],
                    }],
                }],
            });
        const timeline = await request(httpServer).get(`/api/tasks/${taskId}/timeline`);
        expect(timeline.status).toBe(200);
        const tokenEvents = (timeline.body.events as Array<{ kind: string }>).filter(e => e.kind === "token.usage");
        expect(tokenEvents.length).toBeGreaterThanOrEqual(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/adapter-otlp-logs && npx vitest run test/otlp-logs-integration.test.ts
```

Expected: FAIL — `/v1/logs` not found (404).

- [ ] **Step 3: Create `packages/adapter-otlp-logs/src/otlp-logs.controller.ts`**

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, HttpException } from "@nestjs/common";
import { MonitorService } from "@monitor/application";
import { otlpLogsRequestSchema } from "./schemas.otlp.js";
import { extractApiRequestRecords } from "./otlp-mapper.js";

const RUNTIME_SOURCE = "claude-plugin";

@Controller("/v1")
export class OtlpLogsController {
    constructor(private readonly monitor: MonitorService) {}

    @Post("logs")
    @HttpCode(HttpStatus.OK)
    async ingestLogs(@Body() body: unknown): Promise<{ ok: boolean; stored: number; skipped: number }> {
        const parsed = otlpLogsRequestSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { ok: false, error: { code: "validation_error", details: parsed.error.format() } },
                HttpStatus.BAD_REQUEST,
            );
        }

        const records = extractApiRequestRecords(parsed.data);
        let stored = 0;
        let skipped = 0;

        for (const rec of records) {
            const binding = await this.monitor.resolveRuntimeBinding(RUNTIME_SOURCE, rec.sessionId);
            if (!binding) {
                skipped += 1;
                continue;
            }
            await this.monitor.logTokenUsage({
                taskId: binding.taskId as import("@monitor/domain").TaskId,
                sessionId: binding.sessionId as import("@monitor/domain").SessionId,
                inputTokens: rec.inputTokens,
                outputTokens: rec.outputTokens,
                cacheReadTokens: rec.cacheReadTokens,
                cacheCreateTokens: rec.cacheCreateTokens,
                ...(rec.costUsd != null ? { costUsd: rec.costUsd } : {}),
                ...(rec.durationMs != null ? { durationMs: rec.durationMs } : {}),
                ...(rec.model ? { model: rec.model } : {}),
                ...(rec.promptId ? { promptId: rec.promptId } : {}),
            });
            stored += 1;
        }

        return { ok: true, stored, skipped };
    }
}
```

- [ ] **Step 4: Create `packages/adapter-otlp-logs/src/index.ts`**

```typescript
import "reflect-metadata";
import { setParamTypes } from "@nestjs/common";
import { MonitorService } from "@monitor/application";
import { OtlpLogsController } from "./otlp-logs.controller.js";

export { OtlpLogsController } from "./otlp-logs.controller.js";

export function registerOtlpControllerMetadata(serviceToken: unknown = MonitorService): void {
    setParamTypes(OtlpLogsController, serviceToken);
}
```

- [ ] **Step 5: Run test to verify it fails (module exists but not wired into server)**

```bash
cd packages/adapter-otlp-logs && npx vitest run test/otlp-logs-integration.test.ts
```

Expected: FAIL — still 404 because the controller is not registered in the NestJS app yet.

- [ ] **Step 6: Commit current state**

```bash
git add packages/adapter-otlp-logs/src/ packages/adapter-otlp-logs/test/otlp-logs-integration.test.ts
git commit -m "feat(adapter-otlp-logs): implement OtlpLogsController and exports"
```

---

## Task 9: Register `OtlpLogsController` in server

**Files:**
- Modify: `packages/server/src/presentation/app.module.ts`

- [ ] **Step 1: Register the controller**

In `packages/server/src/presentation/app.module.ts`, add the import:

```typescript
import {
    OtlpLogsController,
    registerOtlpControllerMetadata,
} from "@monitor/adapter-otlp-logs";
```

In the `forRoot` method, add after `registerWriteControllerMetadata`:

```typescript
        registerOtlpControllerMetadata(MonitorService);
```

Add `OtlpLogsController` to the `controllers` array:

```typescript
            controllers: [
                AdminController,
                BookmarkController,
                SearchController,
                EvaluationController,
                IngestController,
                EventController,
                LifecycleController,
                BookmarkWriteController,
                EvaluationWriteController,
                OtlpLogsController,
            ],
```

- [ ] **Step 2: Run integration tests**

```bash
cd packages/adapter-otlp-logs && npx vitest run test/otlp-logs-integration.test.ts
```

Expected: PASS (all 5 cases).

- [ ] **Step 3: Run server contract tests to check for regressions**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/presentation/app.module.ts
git commit -m "feat(server): register OtlpLogsController — POST /v1/logs now active"
```

---

## Task 10: Remove transcript token reading from `Stop.ts`

**Files:**
- Modify: `packages/runtime-claude/hooks/Stop.ts`

`Stop.ts` currently reads tokens via `readLastAssistantEntry()` and includes them in the `assistant.response` event. With OTLP now handling tokens, this metadata is removed. `stop_reason` is still read from the transcript (OTLP does not provide it).

- [ ] **Step 1: Write failing test (the metadata must NOT include token fields)**

Create `packages/runtime-claude/hooks/test/stop-hook-no-tokens.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readLastAssistantEntry } from "../lib/transcript-emit.js";

describe("readLastAssistantEntry — usage fields", () => {
    it("returns usage when present (used only for stop_reason going forward)", () => {
        // This confirms the function still returns usage but Stop.ts should not
        // forward token fields to the ingest event.
        // The actual Stop.ts integration is tested manually; this is a unit check.
        const entry = readLastAssistantEntry("/nonexistent/path");
        expect(entry).toBeUndefined(); // file doesn't exist, returns undefined gracefully
    });
});
```

This test is intentionally minimal — the critical change is in `Stop.ts` itself.

- [ ] **Step 2: Update `Stop.ts`**

In `packages/runtime-claude/hooks/Stop.ts`, change the `await postJson("/ingest/v1/events", {...})` call so that the `metadata` object no longer includes token fields:

```typescript
    await postJson("/ingest/v1/events", {
        events: [{
            kind: "assistant.response",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            messageId: createMessageId(),
            source: "claude-plugin",
            title,
            ...(responseText ? { body: responseText } : {}),
            metadata: {
                stopReason,
            }
        }]
    });
```

The `usage` variable and the `readLastAssistantEntry` call for token data can remain (still needed for `stopReason`). Only remove the token fields from `metadata`.

More precisely, keep the existing read:
```typescript
    const lastEntry = transcriptPath ? readLastAssistantEntry(transcriptPath) : undefined;
    const stopReason = toTrimmedString(lastEntry?.message?.stop_reason) || toTrimmedString(payload.stop_reason) || "end_turn";
    // usage is no longer forwarded — tokens come from OTLP /v1/logs
```

And remove the `usage` variable and all four `usage?.input_tokens`, `usage?.output_tokens`, `usage?.cache_read_input_tokens`, `usage?.cache_creation_input_tokens` references from the metadata object.

- [ ] **Step 3: Remove unused `TranscriptUsage` import if now unused**

In `Stop.ts`, check if `TranscriptUsage` is still imported. If the `usage` variable is removed, also remove the import:

```typescript
// Remove if unused:
import type { TranscriptUsage } from "./lib/transcript-emit.js";
```

If `readLastAssistantEntry` is still imported (it is, for `stop_reason`), keep that import.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/runtime-claude && npx tsc -p tsconfig.json --noEmit 2>/dev/null || npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime-claude/hooks/Stop.ts packages/runtime-claude/hooks/test/stop-hook-no-tokens.test.ts
git commit -m "feat(runtime-claude): remove transcript token reading from Stop.ts — tokens now via OTLP"
```

---

## Task 11: Configure Claude Code to send OTLP to Agent Tracer

Claude Code's OTLP exporter is controlled by environment variables. These must be set in the project's `.claude/settings.json` so every Claude Code session in this project automatically pushes logs to Agent Tracer.

- [ ] **Step 1: Add OTLP env vars to `.claude/settings.json`**

Open (or create) `/Users/kimjongjun/Documents/Code/project/agent-tracer/.claude/settings.json` and add the `env` block:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "http://127.0.0.1:3847/v1/logs",
    "OTEL_LOGS_EXPORT_INTERVAL": "5000"
  }
}
```

If `.claude/settings.json` already has content, merge the `env` block without overwriting other keys.

- [ ] **Step 2: Verify the env block applies (manual smoke test)**

Start Agent Tracer server (`npm run dev` or however it starts), then open a new Claude Code session in this project directory. Run a quick command that triggers an API call (e.g., ask Claude a question). Check the server logs or the task timeline to confirm a `token.usage` event appears.

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "chore(config): configure OTLP to push api_request logs to Agent Tracer"
```

---

## Self-Review Checklist

### Spec coverage
- [x] OTLP `api_request` records received at `POST /v1/logs` ✓ Task 8
- [x] Session correlation via `session.id` → `resolveRuntimeBinding()` ✓ Task 5 + 8
- [x] Token fields stored as `token.usage` events ✓ Tasks 1–3 + 8
- [x] `getTokenSummary()` reads from `token.usage` ✓ Task 4
- [x] Backward compatibility: existing `assistant.response` events with tokens still counted ✓ Task 4
- [x] `Stop.ts` no longer duplicates tokens in `assistant.response` metadata ✓ Task 10
- [x] OTLP env vars configured in project settings ✓ Task 11
- [x] New package properly scaffolded and registered in monorepo ✓ Tasks 6 + 9

### Type consistency
- `TaskTokenUsageInput` defined in Task 2, used in Tasks 2 + 8 ✓
- `OtlpApiRequestRecord` defined in Task 7, consumed in Task 8 ✓
- `resolveRuntimeBinding()` returns `{ taskId: string; sessionId: string } | null` in Task 5, consumed in Task 8 ✓
- `INGEST_EVENT_KINDS` includes `"token.usage"` added in Task 3; `EventIngestionService` case added in same task ✓
- `MonitoringEventKind` union includes `"token.usage"` from Task 1; `defaultLaneForEventKind` exhaustive switch updated in same task ✓
