import { describe, expect, it } from "vitest";
import { JOB_KIND, RULE_GENERATION_FOCUS } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { ListPendingJobsUseCase } from "./list.pending.jobs.usecase.js";

describe("ListPendingJobsUseCase", () => {
    it("자신의 대기 잡만 반환한다", async () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const mine = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1", focus: RULE_GENERATION_FOCUS.recent, maxRules: 2 }, now);
        const others = AiJobEntity.create("u2", JOB_KIND.ruleGeneration, { taskId: "t2" }, now);
        const repo = new InMemoryAiJobRepository();
        repo.seed(mine, others);
        const useCase = new ListPendingJobsUseCase(repo);

        const result = await useCase.execute("u1", JOB_KIND.ruleGeneration);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.id).toBe(mine.id);
        expect(result.items[0]?.input).toEqual({ taskId: "t1", focus: RULE_GENERATION_FOCUS.recent, maxRules: 2 });
    });
});
