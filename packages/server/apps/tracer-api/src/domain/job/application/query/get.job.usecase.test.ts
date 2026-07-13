import { describe, expect, it } from "vitest";
import { JOB_KIND } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { GetJobUseCase } from "./get.job.usecase.js";

function makeUseCase(jobs: AiJobEntity[]): GetJobUseCase {
    const repo = new InMemoryAiJobRepository();
    repo.seed(...jobs);
    return new GetJobUseCase(repo);
}

describe("GetJobUseCase", () => {
    it("소유한 잡을 조회하면 DTO로 매핑해 반환한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const useCase = makeUseCase([job]);

        const result = await useCase.execute("u1", job.id);

        expect(result?.id).toBe(job.id);
        expect(result?.taskId).toBe("t1");
    });

    it("남의 잡은 존재 여부를 드러내지 않고 null을 반환한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const useCase = makeUseCase([job]);

        const result = await useCase.execute("u2", job.id);

        expect(result).toBeNull();
    });

    it("존재하지 않는 잡은 null을 반환한다", async () => {
        const useCase = makeUseCase([]);

        const result = await useCase.execute("u1", "missing");

        expect(result).toBeNull();
    });
});
