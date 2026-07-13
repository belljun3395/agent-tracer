import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "@monitor/kernel";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import { FinalizeRecipeScanUsecase } from "./finalize.recipe.scan.usecase.js";
import type { RecipeScanGenerateOutput } from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";
import { CapturingRecipeNotification, fixedClock, seedRepository } from "./recipe.test-support.js";

function output(recipeCount: number): RecipeScanGenerateOutput {
    return {
        modelUsed: "claude-sonnet-4-6",
        durationMs: 900,
        costUsd: 0.4,
        numTurns: 3,
        usage: null,
        attempt: 1,
        recipes: Array.from({ length: recipeCount }, (_value, index) => ({
            id: `recipe-${index}`,
            title: "제목",
            intent: "의도",
            description: "설명",
            summaryMd: "요약",
            request: "요청",
            corrections: [],
            pitfalls: [],
            governingRules: [],
            steps: [],
            touchedFiles: [],
            contributingSlices: [{ taskId: "task-1", eventIds: [] }],
            rationale: "근거",
        })),
        jobSteps: [],
    };
}

describe("FinalizeRecipeScanUsecase", () => {
    it("후보를 저장하고 완료를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingRecipeNotification();
        const target = new FinalizeRecipeScanUsecase(repository, notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.ko,
            output: output(1),
        });

        expect(repository.commits).toHaveLength(1);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.completed,
            summary: "1 recipe candidate",
        });
    });

    it("후보가 없어도 완료로 종결한다", async () => {
        const repository = seedRepository();
        const notification = new CapturingRecipeNotification();
        const target = new FinalizeRecipeScanUsecase(repository, notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.auto,
            output: output(0),
        });

        expect(notification.published[0]?.payload["summary"]).toBe("No recipe candidates produced");
    });

    it("다른 전이가 먼저 잡을 종결했으면 알리지 않는다", async () => {
        const repository = seedRepository();
        repository.commitWins = false;
        const notification = new CapturingRecipeNotification();
        const target = new FinalizeRecipeScanUsecase(repository, notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.auto,
            output: output(1),
        });

        expect(notification.published).toEqual([]);
    });
});
