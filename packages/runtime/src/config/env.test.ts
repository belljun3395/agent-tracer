import {describe, expect, it} from "vitest";
import {resolveClaudeSessionId} from "~runtime/config/env.js";

describe("resolveClaudeSessionId", () => {
    it("Claude Code가 심어 준 세션 식별자를 낸다", () => {
        expect(resolveClaudeSessionId({CLAUDE_CODE_SESSION_ID: "cc-1"})).toBe("cc-1");
    });

    it("값이 없거나 공백뿐이면 undefined다", () => {
        expect(resolveClaudeSessionId({})).toBeUndefined();
        expect(resolveClaudeSessionId({CLAUDE_CODE_SESSION_ID: "   "})).toBeUndefined();
    });
});
