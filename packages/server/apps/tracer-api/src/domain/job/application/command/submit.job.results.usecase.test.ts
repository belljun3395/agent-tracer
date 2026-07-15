import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AI_JOB_STEP_ROLE, JOB_KIND, JOB_STATUS, RULE_EXPECTATION_KIND } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import type { RuleEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/job/port/__fakes__/fixed.clock.js";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { InMemoryAiJobStepRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.step.repository.js";
import { InMemoryEventReader } from "~tracer-api/domain/job/port/rule-verification/__fakes__/in-memory.event.reader.js";
import { InMemoryJobTransaction, InMemoryRuleStore } from "~tracer-api/domain/job/port/__fakes__/in-memory.job.transaction.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/job/port/rule-verification/__fakes__/in-memory.turn.repository.js";
import { SubmitJobResultsUseCase } from "./submit.job.results.usecase.js";
import type { RuleBackfillService } from "~tracer-api/domain/job/application/rule.backfill.service.js";
import { RuleGenerationResultService } from "~tracer-api/domain/job/application/rule.generation.result.service.js";

const CANCELED_AT = new Date("2026-01-01T00:01:00.000Z");

interface MakeUseCaseOptions {
    readonly commitWins?: boolean;
    readonly generatedRules?: RuleGenerationResultService;
}

function makeUseCase(jobs: AiJobEntity[], rules: RuleEntity[] = [], options: MakeUseCaseOptions = {}): {
    readonly useCase: SubmitJobResultsUseCase;
    readonly ruleStore: InMemoryRuleStore;
    readonly stepStore: InMemoryAiJobStepRepository;
} {
    const jobRepo = new InMemoryAiJobRepository();
    jobRepo.seed(...jobs);
    const ruleStore = new InMemoryRuleStore();
    ruleStore.seed(...rules);
    if (options.commitWins === false) jobRepo.loseNextTransitionToCancel(CANCELED_AT);
    const backfill = {} as RuleBackfillService;
    const stepStore = new InMemoryAiJobStepRepository();
    return {
        useCase: new SubmitJobResultsUseCase(
            jobRepo,
            new InMemoryJobTransaction(jobRepo, ruleStore, stepStore),
            options.generatedRules ??
                new RuleGenerationResultService(backfill, new InMemoryEventReader(), new InMemoryTurnRepository()),
            new FixedClock(new Date("2026-01-01T00:00:00.000Z")),
        ),
        ruleStore,
        stepStore,
    };
}

describe("SubmitJobResultsUseCase", () => {
    it("잡 소유자는 결과를 제출해 잡을 완료시킨다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.titleSuggestion, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase } = makeUseCase([job]);
        const result = await useCase.execute({ userId: "u1", id: job.id, result: { title: "제안" } });
        expect(result.job.status).toBe(JOB_STATUS.completed);
    });

    it("결과와 함께 온 실행 궤적을 잡 종결과 한 커밋으로 저장한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase, stepStore } = makeUseCase([job]);

        await useCase.execute({
            userId: "u1",
            id: job.id,
            proposals: [],
            steps: [{
                seq: 0,
                role: AI_JOB_STEP_ROLE.assistant,
                content: "턴을 읽는다",
                truncated: false,
                toolCalls: [{ id: "call-1", name: "get_task_turns", args: { taskId: "t1" } }],
            }],
        });

        expect(stepStore.all()).toHaveLength(1);
        expect(stepStore.all()[0]).toMatchObject({ jobId: job.id, userId: "u1", seq: 0, attempt: 1 });
    });

    it("리스를 잃은 실행기의 결과도 잡이 종결 전이면 받아들인다", async () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const job = AiJobEntity.create("u1", JOB_KIND.titleSuggestion, { taskId: "t1" }, now);
        job.claim("owner-new", now, 60_000);
        const { useCase } = makeUseCase([job]);

        const result = await useCase.execute({ userId: "u1", id: job.id, result: { title: "제안" } });

        expect(result.job.status).toBe(JOB_STATUS.completed);
    });

    it("남의 잡 결과 제출은 존재하지 않는 잡처럼 거부한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.titleSuggestion, { taskId: "t1" }, new Date("2026-01-01T00:00:00.000Z"));
        const { useCase } = makeUseCase([job]);
        await expect(useCase.execute({ userId: "u2", id: job.id, result: {} })).rejects.toThrow(NotFoundException);
    });

    it("규칙 생성 잡 결과는 규칙 경계에서 준비하고 커밋 뒤 후처리한다", async () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, now);
        const afterCommit = vi.fn(async () => undefined);
        const prepare = vi.fn(async () => ({ jobResult: { rulesCreated: 2 }, afterCommit }));
        const generatedRules = { prepare } as unknown as RuleGenerationResultService;
        const { useCase } = makeUseCase([job], [], { generatedRules });

        const result = await useCase.execute({
            userId: "u1",
            id: job.id,
            proposals: [{ name: "제안" }],
        });

        expect(prepare).toHaveBeenCalledWith(expect.objectContaining({
            userId: "u1",
            sourceJobId: job.id,
            taskId: "t1",
            proposals: [{ name: "제안" }],
        }));
        expect(result.job.result).toEqual({ rulesCreated: 2 });
        expect(afterCommit).toHaveBeenCalledOnce();
    });

    it("취소가 완료 커밋과 경합해 지면 생성한 규칙을 롤백한다", async () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, { taskId: "t1" }, now);
        const { useCase, ruleStore } = makeUseCase([job], [], { commitWins: false });

        await useCase.execute({
            userId: "u1",
            id: job.id,
            proposals: [
                {
                    name: "테스트 실행",
                    expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run test"] },
                },
            ],
        });

        expect(ruleStore.all()).toHaveLength(0);
    });
});
