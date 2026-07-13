import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { StartJobUseCase } from "./start.job.usecase.js";

function makeUseCase(jobs: AiJobEntity[]): { useCase: StartJobUseCase; repo: InMemoryAiJobRepository } {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    return { useCase: new StartJobUseCase(repo), repo };
}

describe("StartJobUseCase", () => {
    it("잡 소유자가 pending local job을 running으로 전이한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase } = makeUseCase([job]);

        const result = await useCase.execute("u1", job.id);

        expect(result.job.status).toBe(JOB_STATUS.running);
        expect(result.job.attempts).toBe(1);
        expect(result.job.startedAt).not.toBeNull();
    });

    it("남의 잡 시작은 존재하지 않는 잡처럼 거부한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase } = makeUseCase([job]);

        await expect(useCase.execute("u2", job.id)).rejects.toThrow(NotFoundException);
    });

    it("취소가 먼저 나면 시작이 CAS에서 지고 취소 상태를 돌려준다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase, repo } = makeUseCase([job]);
        repo.loseNextTransitionToCancel(new Date("2026-01-01T00:01:00.000Z"));

        const result = await useCase.execute("u1", job.id);

        expect(result.job.status).toBe(JOB_STATUS.canceled);
    });
});
