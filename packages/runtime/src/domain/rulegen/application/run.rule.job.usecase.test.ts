import {RULE_GENERATION_FOCUS} from "@monitor/kernel/job/job.const.js";
import {afterEach, describe, expect, it, vi} from "vitest";
import {RunRuleJobUsecase} from "~runtime/domain/rulegen/application/run.rule.job.usecase.js";
import type {RuleGenerationOutcome} from "~runtime/domain/rulegen/model/rule.job.model.js";
import {InMemoryRuleEvidence} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.evidence.js";
import {InMemoryRuleGenerator} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.generator.js";
import {InMemoryRuleJob} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.job.js";

const VALID_RULE = {
    name: "테스트 실행",
    expect: {kind: "command", commandMatches: ["npm test"]},
    rationale: "사용자가 요구했다",
};

function outcome(overrides: Partial<RuleGenerationOutcome> = {}): RuleGenerationOutcome {
    return {candidates: [], costUsd: 0.1, numTurns: 2, usage: null, error: null, ...overrides};
}

function turns(count: number): {turnIndex: number; askedText: string; assistantSummary: string}[] {
    return Array.from({length: count}, (_, index) => ({
        turnIndex: index + 1,
        askedText: `요구 ${index + 1}`,
        assistantSummary: "응답",
    }));
}

function events(count: number): {kind: string; title: string; body: string}[] {
    return Array.from({length: count}, (_, index) => ({
        kind: "execute_tool",
        title: `event ${index + 1}`,
        body: "body",
    }));
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("RunRuleJobUsecase", () => {
    it("계약에 맞는 제안만 남겨 상한까지 결과로 보고한다", async () => {
        vi.spyOn(process.stderr, "write").mockReturnValue(true);
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(
            outcome({candidates: [VALID_RULE, {name: "검증 불가", expect: {}}, VALID_RULE, VALID_RULE]}),
        );
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs);

        await usecase.execute({jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws", maxRules: 2});

        expect(jobs.reported).toHaveLength(1);
        expect(jobs.reported[0]?.report.proposals).toHaveLength(2);
        expect(jobs.reported[0]?.report.costUsd).toBe(0.1);
        expect(jobs.failed).toEqual([]);
    });

    it("usage가 없으면 결과 보고에서 뺀다", async () => {
        const jobs = new InMemoryRuleJob();
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), new InMemoryRuleGenerator(outcome()), jobs);

        await usecase.execute({jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"});

        expect(jobs.reported[0]?.report).not.toHaveProperty("usage");
    });

    it("recent 초점이면 마지막 턴과 최근 이벤트만 프롬프트에 싣는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        const evidence = new InMemoryRuleEvidence(turns(3), events(8));
        const usecase = new RunRuleJobUsecase(evidence, generator, jobs);

        await usecase.execute({
            jobId: "job-1",
            taskId: "task-1",
            workspacePath: "/tmp/ws",
            focus: RULE_GENERATION_FOCUS.recent,
        });

        const prompt = generator.specs[0]?.userPrompt ?? "";
        expect(prompt).toContain("요구 3");
        expect(prompt).not.toContain("요구 1");
        expect(prompt).toContain("event 8");
        expect(prompt).not.toContain("event 3");
    });

    it("실행기가 오류를 내면 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome({error: "error_max_budget_usd"}));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs);

        await usecase.execute({jobId: "job-9", taskId: "task-9", workspacePath: "/tmp/ws"});

        expect(jobs.failed).toEqual([{jobId: "job-9", error: "error_max_budget_usd"}]);
        expect(jobs.reported).toEqual([]);
    });

    it("결과 보고가 실패하면 같은 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        jobs.reportOk = false;
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), new InMemoryRuleGenerator(outcome()), jobs);

        await usecase.execute({jobId: "job-2", taskId: "task-2", workspacePath: "/tmp/ws"});

        expect(jobs.failed).toEqual([{jobId: "job-2", error: "result report failed"}]);
    });

    it("근거 조회가 터지면 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const evidence = new InMemoryRuleEvidence();
        vi.spyOn(evidence, "fetchTurns").mockRejectedValue(new Error("HTTP 503"));
        const usecase = new RunRuleJobUsecase(evidence, new InMemoryRuleGenerator(outcome()), jobs);

        await usecase.execute({jobId: "job-3", taskId: "task-3", workspacePath: "/tmp/ws"});

        expect(jobs.failed).toEqual([{jobId: "job-3", error: "HTTP 503"}]);
    });

    it("취소된 잡은 실패로 보고하지 않는다", async () => {
        const jobs = new InMemoryRuleJob();
        const evidence = new InMemoryRuleEvidence();
        vi.spyOn(evidence, "fetchTurns").mockRejectedValue(new Error("aborted"));
        const usecase = new RunRuleJobUsecase(evidence, new InMemoryRuleGenerator(outcome()), jobs);
        const canceled = AbortSignal.abort();

        await usecase.execute({jobId: "job-4", taskId: "task-4", workspacePath: "/tmp/ws"}, canceled);

        expect(jobs.failed).toEqual([]);
    });
});
