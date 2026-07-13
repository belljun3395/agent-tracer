import {describe, expect, it} from "vitest";
import {
    readPostCompact,
    readStop,
    readStopFailure,
} from "~runtime/agent/claude-code/payload/turn.payload.js";

describe("턴 페이로드 리더", () => {
    it("compact 계기가 없으면 manual로 정규화한다", () => {
        expect(readPostCompact({session_id: "session-1"})).toEqual({
            ok: true,
            value: expect.objectContaining({trigger: "manual"}),
        });
    });

    it("오류 종류가 없으면 unknown으로 정규화한다", () => {
        expect(readStopFailure({session_id: "session-1"})).toEqual({
            ok: true,
            value: expect.objectContaining({errorType: "unknown"}),
        });
    });

    it("훅 재진입 표시를 불리언으로 읽는다", () => {
        expect(readStop({session_id: "session-1", stop_hook_active: "true"})).toEqual({
            ok: true,
            value: expect.objectContaining({stopHookActive: true, lastAssistantMessage: ""}),
        });
    });
});
