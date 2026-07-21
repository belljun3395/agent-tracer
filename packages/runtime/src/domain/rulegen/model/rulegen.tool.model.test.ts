import {describe, expect, it} from "vitest";
import {
    RULEGEN_EVENT_LIMIT,
    RULEGEN_MCP_SERVER,
    RULEGEN_TOOL,
    RULEGEN_TOOL_SPECS,
    RULEGEN_WORKSPACE_TOOLS,
    rulegenAllowedTools,
    rulegenToolFailureText,
    rulegenToolFullName,
    rulegenToolSpec,
    resolveEventLimit,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

describe("resolveEventLimit", () => {
    it("상한을 안 주면 기본값으로 물러선다", () => {
        expect(resolveEventLimit(undefined)).toBe(RULEGEN_EVENT_LIMIT.fallback);
    });

    it("범위 밖 값은 최소와 최대 안으로 조인다", () => {
        expect(resolveEventLimit(0)).toBe(RULEGEN_EVENT_LIMIT.min);
        expect(resolveEventLimit(999)).toBe(RULEGEN_EVENT_LIMIT.max);
    });

    it("소수는 버림해 정수로 만든다", () => {
        expect(resolveEventLimit(10.9)).toBe(10);
    });
});

describe("rulegenToolFullName", () => {
    it("모델이 부르는 정식 명칭은 mcp 서버 접두사를 붙인 형식이다", () => {
        expect(rulegenToolFullName(RULEGEN_TOOL.turns)).toBe(`mcp__${RULEGEN_MCP_SERVER}__${RULEGEN_TOOL.turns}`);
    });
});

describe("rulegenToolSpec", () => {
    it("이름으로 명세를 찾는다", () => {
        expect(rulegenToolSpec(RULEGEN_TOOL.events).name).toBe(RULEGEN_TOOL.events);
    });

    it("모르는 도구 이름은 오류로 막는다", () => {
        // @ts-expect-error 계약에 없는 이름을 넣어 실패 경로를 확인한다.
        expect(() => rulegenToolSpec("unknown")).toThrow("unknown rule generation tool");
    });
});

describe("rulegenAllowedTools", () => {
    it("근거 도구의 정식 명칭과 워크스페이스 읽기 도구를 함께 연다", () => {
        const allowed = rulegenAllowedTools(RULEGEN_TOOL_SPECS);

        for (const spec of RULEGEN_TOOL_SPECS) {
            expect(allowed).toContain(rulegenToolFullName(spec.name));
        }
        for (const tool of RULEGEN_WORKSPACE_TOOLS) {
            expect(allowed).toContain(tool);
        }
        expect(allowed).toHaveLength(RULEGEN_TOOL_SPECS.length + RULEGEN_WORKSPACE_TOOLS.length);
    });
});

describe("rulegenToolFailureText", () => {
    it("HTTP 실패를 도구 라벨과 상태 코드로 말해 모델이 다음 수를 두게 한다", () => {
        const spec = rulegenToolSpec(RULEGEN_TOOL.turns);
        expect(rulegenToolFailureText(spec, 500)).toBe(`${spec.failureLabel}: HTTP 500`);
    });
});
