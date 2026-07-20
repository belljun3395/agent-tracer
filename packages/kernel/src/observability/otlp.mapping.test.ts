import { describe, expect, it } from "vitest";
import { KIND, type EventKind } from "../ingest/event.kind.const.js";
import { RUNTIME_SOURCE } from "../ingest/runtime.source.const.js";
import { AGENT_TRACER_ATTR, GEN_AI_PROVIDER, SEMCONV_ATTR } from "./semconv.const.js";
import {
    isUlid,
    spanIdOf,
    traceIdOf,
} from "./otlp/identity.js";
import { buildOtlpLogsBody } from "./otlp/logs.js";
import type { OtlpEventRecord } from "./otlp/model.js";
import { buildOtlpTracesBody } from "./otlp/traces.js";

// 시간부를 0으로 고정하고 해시를 random부에 넣는 결정적 이벤트 ID(runtime의 deterministicSourceEventId).
const DETERMINISTIC_A = "0000000000ABCDEFGHJKMNPQRS";
const DETERMINISTIC_B = "0000000000TVWXYZ0123456789";
const RANDOM_ULID = "01JZ5X8YKQ7WPA9BCDEFGHJKMN";

describe("traceIdOf", () => {
    it("ULID를 32자리 hex trace ID로 변환한다", () => {
        expect(traceIdOf(RANDOM_ULID)).toMatch(/^[0-9a-f]{32}$/);
    });

    it("같은 상관 ID는 항상 같은 trace ID를 준다", () => {
        expect(traceIdOf(RANDOM_ULID)).toBe(traceIdOf(RANDOM_ULID));
    });

    it("ULID가 아닌 식별자도 32자리 hex로 확장한다", () => {
        const traceId = traceIdOf("session-from-somewhere-else");
        expect(traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(traceId).not.toBe("0".repeat(32));
    });
});

describe("spanIdOf", () => {
    it("ULID를 16자리 hex span ID로 변환한다", () => {
        expect(spanIdOf(RANDOM_ULID)).toMatch(/^[0-9a-f]{16}$/);
    });

    it("시간부가 0으로 같은 결정적 이벤트 ID들이 서로 다른 span ID를 가진다", () => {
        // random부가 아니라 시간부에서 span ID를 취하면 결정적 ID 전체가 한 값으로 충돌한다.
        expect(spanIdOf(DETERMINISTIC_A)).not.toBe(spanIdOf(DETERMINISTIC_B));
    });

    it("결정적 이벤트 ID는 재전송해도 같은 span ID를 준다", () => {
        expect(spanIdOf(DETERMINISTIC_A)).toBe(spanIdOf(DETERMINISTIC_A));
    });

    it("어떤 입력에도 0으로만 채워진 span ID를 만들지 않는다", () => {
        expect(spanIdOf("0".repeat(26))).not.toBe("0".repeat(16));
    });
});

function makeRecord(kind: EventKind, payload: Record<string, unknown> = {}): OtlpEventRecord {
    return {
        id: RANDOM_ULID,
        kind,
        taskId: "task-1",
        sessionId: "session-1",
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        parentSpanId: null,
        occurredAt: new Date("2026-07-10T00:00:10.000Z"),
        payload,
    };
}

function attributesOf(entry: Record<string, unknown>): Record<string, unknown> {
    const pairs = entry["attributes"] as { key: string; value: Record<string, unknown> }[];
    return Object.fromEntries(pairs.map((pair) => [pair.key, Object.values(pair.value)[0]]));
}

function firstSpan(body: Record<string, unknown>): Record<string, unknown> {
    const resourceSpans = body["resourceSpans"] as Record<string, unknown>[];
    const scopeSpans = resourceSpans[0]!["scopeSpans"] as Record<string, unknown>[];
    return (scopeSpans[0]!["spans"] as Record<string, unknown>[])[0]!;
}

function firstLog(body: Record<string, unknown>): Record<string, unknown> {
    const resourceLogs = body["resourceLogs"] as Record<string, unknown>[];
    const scopeLogs = resourceLogs[0]!["scopeLogs"] as Record<string, unknown>[];
    return (scopeLogs[0]!["logRecords"] as Record<string, unknown>[])[0]!;
}

describe("buildOtlpTracesBody", () => {
    it("span 클래스 이벤트만 span으로 내보낸다", () => {
        expect(buildOtlpTracesBody([makeRecord(KIND.userMessage)])).toBeNull();
        expect(buildOtlpTracesBody([makeRecord(KIND.executeTool)])).not.toBeNull();
    });

    it("도구 span 이름은 semconv의 오퍼레이션과 대상 형태를 따른다", () => {
        const body = buildOtlpTracesBody([makeRecord(KIND.executeTool, { metadata: { [SEMCONV_ATTR.toolName]: "Grep" } })])!;
        expect(firstSpan(body)["name"]).toBe("execute_tool Grep");
    });

    it("도구 이름이 없으면 오퍼레이션만으로 span 이름을 만든다", () => {
        // 대상을 모를 때 특정 도구 이름으로 떨어뜨리면 셸 실행이 다른 도구로 둔갑한다.
        const body = buildOtlpTracesBody([makeRecord(KIND.executeTool, { metadata: {} })])!;
        expect(firstSpan(body)["name"]).toBe("execute_tool");
    });

    it("지속시간이 있으면 시작 시각을 뒤로 물린다", () => {
        const body = buildOtlpTracesBody([makeRecord(KIND.executeTool, { metadata: { [AGENT_TRACER_ATTR.durationMs]: 1500 } })])!;
        const span = firstSpan(body);
        expect(span["endTimeUnixNano"]).toBe("1783641610000000000");
        expect(span["startTimeUnixNano"]).toBe("1783641608500000000");
    });

    it("지속시간이 없으면 0-duration span을 만든다", () => {
        const span = firstSpan(buildOtlpTracesBody([makeRecord(KIND.executeTool)])!);
        expect(span["startTimeUnixNano"]).toBe(span["endTimeUnixNano"]);
    });

    it("제품 내부 키를 표준 속성으로 승격하고 나머지는 agent_tracer로 격리한다", () => {
        const body = buildOtlpTracesBody([
            makeRecord(KIND.executeTool, { metadata: { [SEMCONV_ATTR.toolName]: "Bash", [AGENT_TRACER_ATTR.command]: "npm test", exitCode: 0 } }),
        ])!;
        const attrs = attributesOf(firstSpan(body));
        expect(attrs[SEMCONV_ATTR.toolName]).toBe("Bash");
        expect(attrs[AGENT_TRACER_ATTR.command]).toBe("npm test");
        expect(attrs["agent_tracer.exitCode"]).toBe("0");
    });

    it("MCP 서버와 도구가 함께 있을 때만 표준 MCP 메서드를 붙인다", () => {
        const withMcp = buildOtlpTracesBody([
            makeRecord(KIND.invokeAgent, { metadata: { [AGENT_TRACER_ATTR.mcpServer]: "gmail", [SEMCONV_ATTR.mcpToolName]: "search" } }),
        ])!;
        expect(attributesOf(firstSpan(withMcp))[SEMCONV_ATTR.mcpMethodName]).toBe("tools/call");

        const withoutMcp = buildOtlpTracesBody([makeRecord(KIND.invokeAgent, { metadata: { [AGENT_TRACER_ATTR.mcpServer]: "gmail" } })])!;
        expect(attributesOf(firstSpan(withoutMcp))[SEMCONV_ATTR.mcpMethodName]).toBeUndefined();
    });

    it("세션을 대화 ID로 싣는다", () => {
        const attrs = attributesOf(firstSpan(buildOtlpTracesBody([makeRecord(KIND.executeTool)])!));
        expect(attrs[SEMCONV_ATTR.conversationId]).toBe("session-1");
    });

    it("런타임 출처를 속성으로 싣고 공급자를 anthropic으로 표기한다", () => {
        const body = buildOtlpTracesBody([makeRecord(KIND.executeTool, {
            metadata: {[AGENT_TRACER_ATTR.runtimeSource]: RUNTIME_SOURCE.claudePlugin},
        })])!;
        const attrs = attributesOf(firstSpan(body));
        expect(attrs[AGENT_TRACER_ATTR.runtimeSource]).toBe(RUNTIME_SOURCE.claudePlugin);
        expect(attrs[SEMCONV_ATTR.providerName]).toBe(GEN_AI_PROVIDER.anthropic);
    });

    it.each([
        [{failed: true, error: "사용자별 원문 오류"}, "operation_failed"],
        [{exitCode: 2}, "non_zero_exit_code"],
        [{interrupted: true}, "interrupted"],
        [{isInterrupt: true}, "interrupted"],
    ])("실패 신호 %o를 ERROR status와 안정적인 오류 유형으로 내보낸다", (metadata, expectedType) => {
        const span = firstSpan(buildOtlpTracesBody([makeRecord(KIND.executeTool, {metadata})])!);
        const attrs = attributesOf(span);
        expect(span["status"]).toEqual({code: 2});
        expect(attrs[SEMCONV_ATTR.errorType]).toBe(expectedType);
        expect(attrs["agent_tracer.error"]).toBeUndefined();
    });

    it("정상 종료 span에는 오류 status를 붙이지 않는다", () => {
        const span = firstSpan(buildOtlpTracesBody([
            makeRecord(KIND.executeTool, {metadata: {exitCode: 0, interrupted: false}}),
        ])!);
        expect(span["status"]).toBeUndefined();
        expect(attributesOf(span)[SEMCONV_ATTR.errorType]).toBeUndefined();
    });

    it("직전 턴이 있으면 그 턴 span으로 가는 link를 건다", () => {
        const previous = "0000000000ABCDEFGHJKMNPQRS";
        const body = buildOtlpTracesBody([
            makeRecord(KIND.invokeAgent, { metadata: { [AGENT_TRACER_ATTR.turnPreviousId]: previous } }),
        ])!;
        // 트레이스가 턴 단위로 갈리므로 link의 traceId도 직전 턴의 것이어야 한다.
        expect(firstSpan(body)["links"]).toEqual([{ traceId: traceIdOf(previous), spanId: spanIdOf(previous) }]);
    });

    it("첫 턴에는 link를 만들지 않는다", () => {
        const span = firstSpan(buildOtlpTracesBody([makeRecord(KIND.invokeAgent)])!);
        expect(span["links"]).toBeUndefined();
    });

    it("구조화 메시지는 span 속성에 JSON 문자열로 직렬화한다", () => {
        const messages = [{ role: "user", parts: [{ type: "text", content: "lint 돌려줘" }] }];
        const body = buildOtlpTracesBody([
            makeRecord(KIND.invokeAgent, { metadata: { [SEMCONV_ATTR.inputMessages]: messages } }),
        ])!;
        const attrs = attributesOf(firstSpan(body));
        expect(attrs[SEMCONV_ATTR.inputMessages]).toBe(JSON.stringify(messages));
    });
});

describe("buildOtlpLogsBody", () => {
    it("span이 아닌 이벤트만 log record로 내보낸다", () => {
        expect(buildOtlpLogsBody([makeRecord(KIND.executeTool)])).toBeNull();
        expect(buildOtlpLogsBody([makeRecord(KIND.userMessage)])).not.toBeNull();
    });

    it("event.name으로 kind를 싣고 본문을 body에 담는다", () => {
        const body = buildOtlpLogsBody([makeRecord(KIND.userMessage, { title: "hi", body: "lint 돌려줘" })])!;
        const log = firstLog(body);
        expect((log["body"] as Record<string, unknown>)["stringValue"]).toBe("lint 돌려줘");
        expect(attributesOf(log)["event.name"]).toBe(KIND.userMessage);
    });


    it("run-event payload의 runtime source를 표준 관측 속성으로 승격한다", () => {
        const log = firstLog(buildOtlpLogsBody([makeRecord(KIND.sessionEnded, {
            runtimeSource: RUNTIME_SOURCE.claudePlugin,
        })])!);
        const attrs = attributesOf(log);
        expect(attrs[AGENT_TRACER_ATTR.runtimeSource]).toBe(RUNTIME_SOURCE.claudePlugin);
        expect(attrs[SEMCONV_ATTR.providerName]).toBe(GEN_AI_PROVIDER.anthropic);
    });

    it("턴 상관키는 인과 부모가 아니라 속성으로만 실린다", () => {
        const body = buildOtlpLogsBody([
            makeRecord(KIND.assistantCommentary, { metadata: { [AGENT_TRACER_ATTR.turnResponseEventId]: "ev-9" } }),
        ])!;
        const log = firstLog(body);
        expect(attributesOf(log)[AGENT_TRACER_ATTR.turnResponseEventId]).toBe("ev-9");
        expect(log["spanId"]).toBe("0123456789abcdef");
    });
});

describe("isUlid", () => {
    it("26자 crockford base32만 ULID로 인정한다", () => {
        expect(isUlid(RANDOM_ULID)).toBe(true);
        expect(isUlid(DETERMINISTIC_A)).toBe(true);
        expect(isUlid("too-short")).toBe(false);
        // 첫 문자가 8 이상이면 128비트를 넘는다.
        expect(isUlid("80000000000000000000000000")).toBe(false);
        // I·L·O·U는 crockford 알파벳에 없다.
        expect(isUlid("0000000000ABCDEFGHIKMNPQRS")).toBe(false);
    });
});
