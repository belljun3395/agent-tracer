import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "@monitor/kernel";
import { FinalizeTitleSuggestionUsecase } from "./finalize.title.suggestion.usecase.js";
import type { TitleSuggestionGenerateOutput } from "~ai-agent-worker/domain/title/model/title.job.model.js";
import { CapturingTitleNotification, fixedClock, seedRepository } from "./title.test-support.js";

function output(suggestionCount: number): TitleSuggestionGenerateOutput {
    return {
        modelUsed: "claude-haiku-4-5",
        durationMs: 700,
        costUsd: 0.02,
        numTurns: 1,
        usage: null,
        attempt: 1,
        suggestions: Array.from({ length: suggestionCount }, (_value, index) => ({
            title: `제목 ${index}`,
            rationale: "근거",
        })),
        jobSteps: [],
    };
}

describe("FinalizeTitleSuggestionUsecase", () => {
    it("제안을 잡 결과에 기록하고 완료를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingTitleNotification();
        const target = new FinalizeTitleSuggestionUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", output: output(2) });

        expect(repository.commits).toHaveLength(1);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.completed,
            summary: "2 title suggestions",
        });
    });

    it("제안이 없어도 완료로 종결한다", async () => {
        const repository = seedRepository();
        const notification = new CapturingTitleNotification();
        const target = new FinalizeTitleSuggestionUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", output: output(0) });

        expect(notification.published[0]?.payload["summary"]).toBe("No title alternatives produced");
    });

    it("다른 전이가 먼저 잡을 종결했으면 알리지 않는다", async () => {
        const repository = seedRepository();
        repository.commitWins = false;
        const notification = new CapturingTitleNotification();
        const target = new FinalizeTitleSuggestionUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", output: output(2) });

        expect(notification.published).toEqual([]);
    });
});
