import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AI_JOB_STEP_ROLE, JOB_KIND, JOB_STATUS, type AiJobStepPayload } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/job/port/__fakes__/fixed.clock.js";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { InMemoryAiJobStepRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.step.repository.js";
import { FailJobUseCase } from "./fail.job.usecase.js";

const STEP: AiJobStepPayload = {
    seq: 0,
    role: AI_JOB_STEP_ROLE.assistant,
    content: "턴을 읽는다",
    truncated: false,
    toolCalls: [{ id: "call-1", name: "get_task_turns", args: { taskId: "t1" } }],
};

interface Harness {
    readonly useCase: FailJobUseCase;
    readonly repo: InMemoryAiJobRepository;
    readonly steps: InMemoryAiJobStepRepository;
}

function makeUseCase(jobs: AiJobEntity[]): Harness {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    const steps = new InMemoryAiJobStepRepository();
    return {
        useCase: new FailJobUseCase(repo, steps, new FixedClock(new Date("2026-01-01T00:00:00.000Z"))),
        repo,
        steps,
    };
}

function runningJob(): AiJobEntity {
    const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
    job.start(new Date("2026-01-01T00:00:10.000Z"));
    return job;
}

describe("FailJobUseCase", () => {
    it("실행 중인 잡을 failed로 전이하고 오류를 담는다", async () => {
        const job = runningJob();
        const { useCase } = makeUseCase([job]);

        const result = await useCase.execute({ userId: "u1", id: job.id, error: "boom" });

        expect(result.job.status).toBe(JOB_STATUS.failed);
        expect(result.job.error).toBe("boom");
    });

    it("남의 잡 실패 보고는 존재하지 않는 잡처럼 거부한다", async () => {
        const job = runningJob();
        const { useCase } = makeUseCase([job]);

        await expect(useCase.execute({ userId: "u2", id: job.id, error: "boom" })).rejects.toThrow(NotFoundException);
    });

    it("취소가 먼저 나면 실패가 CAS에서 지고 취소 상태를 돌려준다", async () => {
        const job = runningJob();
        const { useCase, repo } = makeUseCase([job]);
        repo.loseNextTransitionToCancel(new Date("2026-01-01T00:01:00.000Z"));

        const result = await useCase.execute({ userId: "u1", id: job.id, error: "boom" });

        expect(result.job.status).toBe(JOB_STATUS.canceled);
    });

    it("실패한 시도가 청구한 비용을 잡 사용량에 남긴다", async () => {
        const job = runningJob();
        const { useCase, repo } = makeUseCase([job]);

        await useCase.execute({
            userId: "u1",
            id: job.id,
            error: "error_max_turns",
            usage: { model: "claude-sonnet-4-6", costUsd: 0.42, numTurns: 15 },
        });

        expect(repo.snapshot().get(job.id)?.usage).toEqual({
            model: "claude-sonnet-4-6",
            costUsd: 0.42,
            numTurns: 15,
        });
    });

    it("실패한 시도가 남긴 궤적을 저장한다", async () => {
        const job = runningJob();
        const { useCase, steps } = makeUseCase([job]);

        await useCase.execute({ userId: "u1", id: job.id, error: "boom", steps: [STEP] });

        expect(steps.all()).toHaveLength(1);
        expect(steps.all()[0]).toMatchObject({ jobId: job.id, userId: "u1", seq: 0, attempt: 1 });
    });

    it("내용이 없는 궤적 스텝은 저장하지 않는다", async () => {
        const job = runningJob();
        const { useCase, steps } = makeUseCase([job]);

        await useCase.execute({
            userId: "u1",
            id: job.id,
            error: "boom",
            steps: [{ seq: 0, role: AI_JOB_STEP_ROLE.assistant, content: "", truncated: false, toolCalls: [] }],
        });

        expect(steps.all()).toEqual([]);
    });
});
