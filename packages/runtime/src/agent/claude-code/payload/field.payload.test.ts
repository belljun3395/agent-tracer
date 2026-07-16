import {describe, expect, it} from "vitest";
import {
    requireSessionId,
    requireToolName,
} from "~runtime/agent/claude-code/payload/field.payload.js";

describe("requireSessionId", () => {
    it("세션 식별자가 있으면 통과로 null을 낸다", () => {
        expect(requireSessionId({session_id: "session-1"})).toBeNull();
    });

    it("세션 식별자가 없으면 리더 실패를 낸다", () => {
        expect(requireSessionId({})).toEqual({ok: false, reason: "missing session_id"});
    });

    it("공백뿐인 세션 식별자도 없는 것으로 본다", () => {
        expect(requireSessionId({session_id: "   "})).toEqual({ok: false, reason: "missing session_id"});
    });
});

describe("requireToolName", () => {
    it("도구 이름이 있으면 통과로 null을 낸다", () => {
        expect(requireToolName({tool_name: "Bash"})).toBeNull();
    });

    it("도구 이름이 없으면 리더 실패를 낸다", () => {
        expect(requireToolName({})).toEqual({ok: false, reason: "missing tool_name"});
    });
});
