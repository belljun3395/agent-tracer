import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { CHAT_TOOL, JOB_KIND } from "@monitor/kernel";
import { buildChatToolExecutors, type ChatToolExecutorDeps } from "./chat.tool.executors.js";

function buildDeps(enqueueJobExecute: (...args: unknown[]) => Promise<unknown>): ChatToolExecutorDeps {
    const stub = (): Promise<unknown> => Promise.resolve({});
    const parts: Record<string, unknown> = {
        tasks: { findById: () => Promise.resolve(null) },
        renameTask: { execute: stub },
        setTaskStatus: { execute: stub },
        archiveTask: { execute: stub },
        unarchiveTask: { execute: stub },
        hideTask: { execute: stub },
        createMemo: { execute: stub },
        updateMemo: { execute: stub },
        deleteMemo: { execute: stub },
        createRule: { execute: stub },
        updateRule: { execute: stub },
        deleteRule: { execute: stub },
        approveRule: { execute: () => Promise.resolve({ reevaluated: 0 }) },
        reevaluateRule: { execute: () => Promise.resolve({ reevaluated: 0 }) },
        createTag: { execute: stub },
        updateTag: { execute: stub },
        deleteTag: { execute: stub },
        setTaskTags: { execute: stub },
        acceptRecipe: { execute: stub },
        dismissRecipe: { execute: stub },
        retireRecipe: { execute: stub },
        acceptCleanup: { execute: stub },
        dismissCleanup: { execute: stub },
        putSetting: { execute: stub },
        deleteSetting: { execute: stub },
        enqueueJob: { execute: enqueueJobExecute },
    };
    return parts as unknown as ChatToolExecutorDeps;
}

describe("buildChatToolExecutors: enqueue_job", () => {
    it("kind와 input을 파싱해 종류별 스키마로 검증한 뒤 EnqueueJobUseCase를 호출한다", async () => {
        const execute = vi.fn().mockResolvedValue({ job: { id: "job1", status: "pending" } });
        const executors = buildChatToolExecutors(buildDeps(execute));

        const result = await executors[CHAT_TOOL.enqueueJob]!("u1", {
            kind: JOB_KIND.titleSuggestion,
            input: JSON.stringify({ taskId: "t1" }),
        });

        expect(execute).toHaveBeenCalledWith("u1", JOB_KIND.titleSuggestion, { taskId: "t1" }, {});
        expect(result).toBe(`Enqueued ${JOB_KIND.titleSuggestion} job job1 (status: pending).`);
    });

    it("agentBackend을 정규화해 실행 옵션으로 넘긴다", async () => {
        const execute = vi.fn().mockResolvedValue({ job: { id: "job2", status: "pending" } });
        const executors = buildChatToolExecutors(buildDeps(execute));

        await executors[CHAT_TOOL.enqueueJob]!("u1", {
            kind: JOB_KIND.recipeScan,
            input: JSON.stringify({ taskId: "t1", trigger: "session" }),
            agentBackend: "claude-sdk",
        });

        expect(execute).toHaveBeenCalledWith(
            "u1",
            JOB_KIND.recipeScan,
            { taskId: "t1", trigger: "session" },
            { agentBackend: "claude-sdk" },
        );
    });

    it("종류별 스키마를 어긴 input은 유스케이스를 부르지 않고 거부한다", async () => {
        const execute = vi.fn();
        const executors = buildChatToolExecutors(buildDeps(execute));

        await expect(
            executors[CHAT_TOOL.enqueueJob]!("u1", { kind: JOB_KIND.titleSuggestion, input: JSON.stringify({}) }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(execute).not.toHaveBeenCalled();
    });

    it("JSON이 아닌 input은 유스케이스를 부르지 않고 거부한다", async () => {
        const execute = vi.fn();
        const executors = buildChatToolExecutors(buildDeps(execute));

        await expect(
            executors[CHAT_TOOL.enqueueJob]!("u1", { kind: JOB_KIND.taskCleanup, input: "not json" }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(execute).not.toHaveBeenCalled();
    });
});
