import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { JOB_FEEDBACK_KIND, JOB_KIND } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { InMemoryJobFeedbackRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.job.feedback.repository.js";
import { SubmitJobFeedbackUseCase } from "./submit.job.feedback.usecase.js";

function makeUseCase(jobs: AiJobEntity[]): {
    readonly useCase: SubmitJobFeedbackUseCase;
    readonly feedbackRepo: InMemoryJobFeedbackRepository;
} {
    const jobRepo = new InMemoryAiJobRepository();
    jobRepo.seed(...jobs);
    const feedbackRepo = new InMemoryJobFeedbackRepository();
    return {
        useCase: new SubmitJobFeedbackUseCase(jobRepo, feedbackRepo),
        feedbackRepo,
    };
}

describe("SubmitJobFeedbackUseCase", () => {
    it("잡 소유자는 명시 피드백을 저장한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase, feedbackRepo } = makeUseCase([job]);

        const result = await useCase.execute({
            userId: "u1",
            jobId: job.id,
            kind: JOB_FEEDBACK_KIND.rating,
            ratingValue: 5,
        });

        expect(result.feedback.jobId).toBe(job.id);
        expect(result.feedback.kind).toBe(JOB_FEEDBACK_KIND.rating);
        expect(result.feedback.ratingValue).toBe(5);
        expect(feedbackRepo.all()).toHaveLength(1);
    });

    it("규칙 id를 대상으로 지정하면 피드백에 함께 저장한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase, feedbackRepo } = makeUseCase([job]);

        const result = await useCase.execute({
            userId: "u1",
            jobId: job.id,
            targetId: "rule-1",
            kind: JOB_FEEDBACK_KIND.accept,
        });

        expect(result.feedback.targetId).toBe("rule-1");
        expect(feedbackRepo.all()[0]?.targetId).toBe("rule-1");
    });

    it("남의 잡 피드백은 존재하지 않는 잡처럼 거부한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.titleSuggestion, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase } = makeUseCase([job]);

        await expect(useCase.execute({ userId: "u2", jobId: job.id, kind: JOB_FEEDBACK_KIND.accept })).rejects.toThrow(NotFoundException);
    });
});
