import {describe, expect, it} from "vitest";
import {
    SESSION_END_REASON,
    readSessionEnd,
    readSessionStart,
    readUserPromptSubmit,
} from "~runtime/agent/claude-code/payload/session.payload.js";

describe("세션 페이로드 리더", () => {
    it("세션 공통 필드와 시작 정보를 함께 정규화한다", () => {
        expect(readSessionStart({
            session_id: "session-1",
            cwd: "/workspace",
            transcript_path: "/tmp/session.jsonl",
            permission_mode: "default",
            source: "resume",
            model: "claude-sonnet",
        })).toEqual({
            ok: true,
            value: expect.objectContaining({
                sessionId: "session-1",
                cwd: "/workspace",
                transcriptPath: "/tmp/session.jsonl",
                permissionMode: "default",
                source: "resume",
                model: "claude-sonnet",
            }),
        });
    });

    it("세션 식별자가 없으면 건너뛴다", () => {
        expect(readSessionEnd({reason: "clear"})).toEqual({ok: false, reason: "missing session_id"});
    });

    it("알려진 종료 사유 어휘는 와이어 값을 그대로 담는다", () => {
        expect(SESSION_END_REASON).toEqual({clear: "clear", promptInputExit: "prompt_input_exit"});
    });

    it("모르는 종료 사유도 원본 문자열로 읽어 넘긴다", () => {
        expect(readSessionEnd({session_id: "session-1", reason: "logout"})).toEqual({
            ok: true,
            value: expect.objectContaining({reason: "logout"}),
        });
    });

    it("빈 프롬프트도 빈 문자열로 읽는다", () => {
        expect(readUserPromptSubmit({session_id: "session-1"})).toEqual({
            ok: true,
            value: expect.objectContaining({prompt: ""}),
        });
    });
});
