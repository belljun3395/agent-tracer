import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {
    fileChangedEvent,
    instructionsLoadedEvent,
    permissionDeniedEvent,
    permissionRequestEvent,
    subagentFinishedEvent,
    subagentStartedEvent,
    worktreeEvent,
} from "~runtime/domain/ingest/model/workspace.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1"};
const PROJECT_DIR = "/repo";

describe("워크스페이스 이벤트", () => {
    it("지침 로드는 파일명을 제목에, 상대 경로를 본문에 담는다", () => {
        const event = instructionsLoadedEvent(TARGET, {
            projectDir: PROJECT_DIR,
            filePath: "/repo/docs/CLAUDE.md",
            loadReason: "session_start",
            memoryType: "Project",
        });

        expect(event.kind).toBe(KIND.instructionsLoaded);
        expect(event.title).toBe("Instructions loaded: CLAUDE.md");
        expect(event.body).toBe("docs/CLAUDE.md");
    });

    it("압축으로 다시 로드된 지침은 제목을 달리한다", () => {
        const event = instructionsLoadedEvent(TARGET, {
            projectDir: PROJECT_DIR,
            filePath: "/repo/CLAUDE.md",
            loadReason: "compact",
            memoryType: "Project",
        });

        expect(event.title).toBe("Instructions reloaded: CLAUDE.md");
    });

    it("파일 변경은 절대 경로를 filePaths로 싣는다", () => {
        const event = fileChangedEvent(TARGET, PROJECT_DIR, "/repo/src/a.ts");

        expect(event.kind).toBe(KIND.fileChanged);
        expect(event.filePaths).toEqual(["/repo/src/a.ts"]);
        expect(event.body).toBe("src/a.ts");
    });

    it("worktree 생성과 제거를 다른 kind로 나눈다", () => {
        expect(worktreeEvent(TARGET, PROJECT_DIR, "/repo/wt", "create").kind).toBe(KIND.worktreeCreate);
        expect(worktreeEvent(TARGET, PROJECT_DIR, "/repo/wt", "remove").kind).toBe(KIND.worktreeRemove);
    });
});

describe("권한 이벤트", () => {
    it("권한 요청은 도구 입력을 요약해 담는다", () => {
        const event = permissionRequestEvent(TARGET, {
            toolName: "Bash",
            toolInput: {command: "rm -rf /"},
            suggestionCount: 2,
        });

        expect(event.kind).toBe(KIND.permissionRequest);
        expect(event.body).toContain("rm -rf /");
        expect((event.metadata as Record<string, unknown>)["suggestionCount"]).toBe(2);
    });

    it("자동 거부는 규칙 이벤트로 남는다", () => {
        const event = permissionDeniedEvent(TARGET, "Bash", {command: "curl evil"});

        expect(event.kind).toBe(KIND.ruleLogged);
        expect((event.metadata as Record<string, unknown>)["ruleOutcome"]).toBe("auto_deny");
    });
});

describe("서브에이전트 수명주기 이벤트", () => {
    it("시작은 running으로, 종료는 completed로 남는다", () => {
        const started = subagentStartedEvent(TARGET, {
            agentId: "agent-1",
            agentType: "Explore",
            parentSessionId: "claude-1",
            childTaskId: "task-2",
        });
        const finished = subagentFinishedEvent(TARGET, {
            agentId: "agent-1",
            agentType: "Explore",
            parentSessionId: "claude-1",
            lastMessage: "완료",
        });

        expect((started.metadata as Record<string, unknown>)["asyncStatus"]).toBe("running");
        expect((started.metadata as Record<string, unknown>)["childTaskId"]).toBe("task-2");
        expect((finished.metadata as Record<string, unknown>)["asyncStatus"]).toBe("completed");
        expect(finished.body).toBe("완료");
    });
});
