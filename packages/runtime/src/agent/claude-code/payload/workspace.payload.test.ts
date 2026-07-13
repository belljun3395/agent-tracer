import {describe, expect, it} from "vitest";
import {
    readFileChanged,
    readUserPromptExpansion,
    readWorktree,
} from "~runtime/agent/claude-code/payload/workspace.payload.js";

describe("워크스페이스 페이로드 리더", () => {
    it("필수 경로가 없는 파일과 worktree 이벤트를 거부한다", () => {
        expect(readFileChanged({session_id: "session-1"})).toEqual({
            ok: false,
            reason: "missing file_path",
        });
        expect(readWorktree({session_id: "session-1"})).toEqual({
            ok: false,
            reason: "missing worktree_path",
        });
    });

    it("확장 종류가 없으면 슬래시 커맨드로 정규화한다", () => {
        expect(readUserPromptExpansion({session_id: "session-1", command_name: "qa"})).toEqual({
            ok: true,
            value: expect.objectContaining({expansionType: "slash_command", commandName: "qa"}),
        });
    });

    it("명령 이름이 없는 확장은 거부한다", () => {
        expect(readUserPromptExpansion({session_id: "session-1"})).toEqual({
            ok: false,
            reason: "missing command_name",
        });
    });
});
