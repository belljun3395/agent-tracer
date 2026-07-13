import { describe, expect, it } from "vitest";
import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "../observability/semconv.const.js";
import {
    KIND,
    MONITOR_TOOL_NAME,
    TERMINAL_COMMAND_TOOL_NAME,
    TIMELINE_EVENT_KINDS,
    TOOL_ACTIVITY_EVENT_KINDS,
    WORKFLOW_EVENT_KINDS,
    CONVERSATION_EVENT_KINDS,
    COORDINATION_EVENT_KINDS,
    LIFECYCLE_EVENT_KINDS,
    SPAN_EVENT_KINDS,
    isMonitorObservation,
    isSpanEventKind,
    isTerminalCommand,
    toolNameOf,
} from "./event.kind.const.js";

describe("KIND", () => {
    it("서로 다른 키가 같은 와이어 문자열을 쓰지 않는다", () => {
        const values = Object.values(KIND);
        expect(new Set(values).size).toBe(values.length);
    });

    it("표준 대응이 없는 kind는 agent_tracer 네임스페이스에 격리한다", () => {
        const standard = new Set<string>([KIND.executeTool, KIND.invokeAgent, KIND.planLogged, KIND.tokenUsage]);
        for (const value of Object.values(KIND)) {
            if (standard.has(value)) continue;
            expect(value.startsWith("agent_tracer.")).toBe(true);
        }
    });
});

describe("TIMELINE_EVENT_KINDS", () => {
    it("하위 그룹(도구·워크플로·대화·협업·라이프사이클)을 합성한 결과에 중복이 없다", () => {
        expect(new Set(TIMELINE_EVENT_KINDS).size).toBe(TIMELINE_EVENT_KINDS.length);
    });

    it("도구·워크플로·대화·협업·라이프사이클 그룹의 합집합과 정확히 같다", () => {
        const union = new Set<string>([
            ...TOOL_ACTIVITY_EVENT_KINDS,
            ...WORKFLOW_EVENT_KINDS,
            ...CONVERSATION_EVENT_KINDS,
            ...COORDINATION_EVENT_KINDS,
            ...LIFECYCLE_EVENT_KINDS,
        ]);
        expect(new Set(TIMELINE_EVENT_KINDS)).toEqual(union);
    });
});

describe("CONVERSATION_EVENT_KINDS", () => {
    it("중간 어시스턴트 발화를 최종 응답과 별도 대화 이벤트로 등록한다", () => {
        expect(CONVERSATION_EVENT_KINDS).toContain(KIND.assistantCommentary);
        expect(KIND.assistantCommentary).not.toBe(KIND.assistantResponse);
    });
});

describe("execute_tool 술어", () => {
    it("명령문을 실은 이벤트만 터미널 명령으로 판정한다", () => {
        expect(isTerminalCommand({ metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } })).toBe(true);
        expect(isTerminalCommand({ metadata: { [AGENT_TRACER_ATTR.command]: "Get-Item", [SEMCONV_ATTR.toolName]: "PowerShell" } })).toBe(true);
        expect(isTerminalCommand({ metadata: { [SEMCONV_ATTR.toolName]: "Read" } })).toBe(false);
        expect(isTerminalCommand({ metadata: { [AGENT_TRACER_ATTR.command]: "  " } })).toBe(false);
        expect(isTerminalCommand({ metadata: {} })).toBe(false);
    });

    it("관측 도구 이름을 가진 이벤트만 모니터 관측으로 판정한다", () => {
        expect(isMonitorObservation({ metadata: { [SEMCONV_ATTR.toolName]: MONITOR_TOOL_NAME } })).toBe(true);
        expect(isMonitorObservation({ metadata: { [SEMCONV_ATTR.toolName]: TERMINAL_COMMAND_TOOL_NAME } })).toBe(false);
    });

    it("메타데이터에 도구 이름이 없으면 이벤트 컬럼으로 떨어진다", () => {
        expect(toolNameOf({ toolName: "Grep", metadata: {} })).toBe("Grep");
        expect(toolNameOf({ toolName: "Grep", metadata: { [SEMCONV_ATTR.toolName]: "Glob" } })).toBe("Glob");
        expect(toolNameOf({ toolName: null, metadata: {} })).toBeUndefined();
    });
});

describe("SPAN_EVENT_KINDS", () => {
    it("지속시간을 가지는 kind만 span으로 분류한다", () => {
        for (const kind of SPAN_EVENT_KINDS) expect(isSpanEventKind(kind)).toBe(true);
        expect(isSpanEventKind(KIND.userMessage)).toBe(false);
        expect(isSpanEventKind(KIND.tokenUsage)).toBe(false);
    });
});
