import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { FailJobUseCase } from "./fail.job.usecase.js";

function makeUseCase(jobs: AiJobEntity[]): { useCase: FailJobUseCase; repo: InMemoryAiJobRepository } {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    return { useCase: new FailJobUseCase(repo), repo };
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

        const result = await useCase.execute("u1", job.id, "boom");

        expect(result.job.status).toBe(JOB_STATUS.failed);
        expect(result.job.error).toBe("boom");
    });

    it("남의 잡 실패 보고는 존재하지 않는 잡처럼 거부한다", async () => {
        const job = runningJob();
        const { useCase } = makeUseCase([job]);

        await expect(useCase.execute("u2", job.id, "boom")).rejects.toThrow(NotFoundException);
    });

    it("취소가 먼저 나면 실패가 CAS에서 지고 취소 상태를 돌려준다", async () => {
        const job = runningJob();
        const { useCase, repo } = makeUseCase([job]);
        repo.loseNextTransitionToCancel(new Date("2026-01-01T00:01:00.000Z"));

        const result = await useCase.execute("u1", job.id, "boom");

        expect(result.job.status).toBe(JOB_STATUS.canceled);
    });
});
