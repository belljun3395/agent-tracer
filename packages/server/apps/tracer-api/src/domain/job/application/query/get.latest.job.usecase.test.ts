import { describe, expect, it } from "vitest";
import { JOB_KIND } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { GetLatestJobUseCase } from "./get.latest.job.usecase.js";

function jobAt(taskId: string, createdAt: string): AiJobEntity {
    return AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId }, new Date(createdAt));
}

function makeUseCase(jobs: AiJobEntity[]): GetLatestJobUseCase {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    return new GetLatestJobUseCase(repo);
}

describe("GetLatestJobUseCase", () => {
    it("같은 태스크의 최신 잡을 반환한다", async () => {
        const older = jobAt("t1", "2026-01-01T00:00:00.000Z");
        const newer = jobAt("t1", "2026-01-02T00:00:00.000Z");
        const useCase = makeUseCase([older, newer]);

        const result = await useCase.execute("u1", JOB_KIND.ruleGeneration, "t1");

        expect(result.job?.id).toBe(newer.id);
    });

    it("일치하는 잡이 없으면 null을 반환한다", async () => {
        const useCase = makeUseCase([]);

        const result = await useCase.execute("u1", JOB_KIND.ruleGeneration, "t1");

        expect(result.job).toBeNull();
    });
});
