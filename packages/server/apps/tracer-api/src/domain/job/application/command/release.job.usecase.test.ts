import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { AiJobEntity, InvariantViolationError } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { ReleaseJobUseCase } from "./release.job.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(jobs: AiJobEntity[]): ReleaseJobUseCase {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    return new ReleaseJobUseCase(repo);
}

function runningJob(owner: string): AiJobEntity {
    const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, NOW);
    job.claim(owner, NOW, 60_000);
    return job;
}

describe("ReleaseJobUseCase", () => {
    it("리스를 쥔 실행기는 잡을 대기로 반납한다", async () => {
        const job = runningJob("owner-1");
        const useCase = makeUseCase([job]);

        const result = await useCase.execute("u1", job.id, "owner-1");

        expect(result.job.status).toBe(JOB_STATUS.pending);
    });

    it("리스를 잃은 구실행기는 남이 진행 중인 잡을 반납하지 못한다", async () => {
        const job = runningJob("owner-new");
        const useCase = makeUseCase([job]);

        await expect(useCase.execute("u1", job.id, "owner-old")).rejects.toThrow(InvariantViolationError);
    });

    it("남의 잡 반납은 존재하지 않는 잡처럼 거부한다", async () => {
        const job = runningJob("owner-1");
        const useCase = makeUseCase([job]);

        await expect(useCase.execute("u2", job.id, "owner-1")).rejects.toThrow(NotFoundException);
    });
});
