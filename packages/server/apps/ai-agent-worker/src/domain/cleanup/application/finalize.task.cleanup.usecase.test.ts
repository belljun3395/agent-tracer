import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "@monitor/kernel";
import { FinalizeTaskCleanupUsecase } from "./finalize.task.cleanup.usecase.js";
import type { TaskCleanupGenerateOutput } from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";
import { CapturingCleanupNotification, fixedClock, seedRepository } from "./cleanup.test-support.js";

function output(suggestionCount: number): TaskCleanupGenerateOutput {
    return {
        modelUsed: "claude-haiku-4-5",
        durationMs: 1200,
        costUsd: 0.05,
        numTurns: 3,
        usage: null,
        attempt: 1,
        suggestions: Array.from({ length: suggestionCount }, (_value, index) => ({
            id: `suggestion-${index}`,
            taskId: `task-${index}`,
            rationale: "이벤트가 없다",
            observedLastEventAt: null,
        })),
        jobSteps: [],
    };
}

describe("FinalizeTaskCleanupUsecase", () => {
    it("제안을 저장하고 완료를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingCleanupNotification();
        const target = new FinalizeTaskCleanupUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", tasksScanned: 7, output: output(2) });

        expect(repository.commits).toHaveLength(1);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.completed,
            summary: "2 cleanup suggestions for 7 tasks",
        });
    });

    it("후보가 없어 모델을 부르지 않았어도 완료로 종결한다", async () => {
        const repository = seedRepository();
        const notification = new CapturingCleanupNotification();
        const target = new FinalizeTaskCleanupUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", tasksScanned: 4, output: null });

        expect(repository.commits[0]?.usage).toEqual({});
        expect(notification.published[0]?.payload["summary"]).toBe("No cleanup suggestions for 4 tasks");
    });

    it("다른 전이가 먼저 잡을 종결했으면 알리지 않는다", async () => {
        const repository = seedRepository();
        repository.commitWins = false;
        const notification = new CapturingCleanupNotification();
        const target = new FinalizeTaskCleanupUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", tasksScanned: 7, output: output(2) });

        expect(notification.published).toEqual([]);
    });
});
