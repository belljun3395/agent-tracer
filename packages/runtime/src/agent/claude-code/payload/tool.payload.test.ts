import {describe, expect, it} from "vitest";
import {
    readPermissionDenied,
    readPermissionRequest,
    readPostToolBatch,
    readPostToolUse,
    readPostToolUseFailure,
} from "~runtime/agent/claude-code/payload/tool.payload.js";

describe("도구 페이로드 리더", () => {
    it("실패한 도구 실행을 안전한 값으로 정규화한다", () => {
        expect(readPostToolUseFailure({
            session_id: "session-1",
            tool_name: "Bash",
            tool_input: {command: "pwd"},
            error: "failed",
            is_interrupt: true,
        })).toEqual({
            ok: true,
            value: expect.objectContaining({
                toolName: "Bash",
                toolInput: {command: "pwd"},
                error: "failed",
                isInterrupt: true,
            }),
        });
    });

    it("배치 호출에서 이름 없는 항목을 버린다", () => {
        expect(readPostToolBatch({
            session_id: "session-1",
            tool_use_ids: ["tool-1", 7],
            tool_calls: [
                {tool_name: "Read", tool_input: {file_path: "/tmp/a"}},
                {tool_input: {file_path: "/tmp/b"}},
                null,
            ],
        })).toEqual({
            ok: true,
            value: expect.objectContaining({
                toolUseIds: ["tool-1", "7"],
                toolCalls: [{toolName: "Read", toolInput: {file_path: "/tmp/a"}}],
            }),
        });
    });

    it("도구 이름이 없는 성공 훅은 건너뛴다", () => {
        expect(readPostToolUse({session_id: "session-1", tool_input: {}})).toEqual({
            ok: false,
            reason: "missing tool_name",
        });
    });

    it("도구 이름이 없는 실패 훅은 건너뛴다", () => {
        expect(readPostToolUseFailure({session_id: "session-1"})).toEqual({
            ok: false,
            reason: "missing tool_name",
        });
    });

    it("도구 이름이 없는 권한 거부 훅은 건너뛴다", () => {
        expect(readPermissionDenied({session_id: "session-1"})).toEqual({
            ok: false,
            reason: "missing tool_name",
        });
    });

    it("권한 제안 수를 센다", () => {
        expect(readPermissionRequest({
            session_id: "session-1",
            tool_name: "Bash",
            permission_suggestions: [{}, {}],
        })).toEqual({
            ok: true,
            value: expect.objectContaining({suggestionCount: 2}),
        });
    });
});
