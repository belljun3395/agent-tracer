import {describe, expect, it, vi, afterEach} from "vitest";
import {RunRuleJobUsecase} from "~runtime/domain/rulegen/application/run.rule.job.usecase.js";
import type {RuleGenerationOutcome} from "~runtime/domain/rulegen/model/rule.job.model.js";
import {
    RULEGEN_EVENT_LIMIT,
    RULEGEN_TOOL,
    type RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import {RuleEvidenceHttpError} from "~runtime/domain/rulegen/port/rule.evidence.port.js";
import {InMemoryRuleEvidence} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.evidence.js";
import {InMemoryRuleGenerator} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.generator.js";
import {InMemoryRuleJob} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.job.js";

const VALID_RULE = {
    name: "테스트 실행",
    expect: {kind: "command", commandMatches: ["npm test"]},
    rationale: "사용자가 요구했다",
};

const REQUEST = {jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"};

function outcome(overrides: Partial<RuleGenerationOutcome> = {}): RuleGenerationOutcome {
    return {candidates: [], costUsd: 0.1, numTurns: 2, usage: null, error: null, ...overrides};
}

function events(count: number): {kind: string; title: string; body: string}[] {
    return Array.from({length: count}, (_, index) => ({
        kind: "execute_tool",
        title: `event ${index + 1}`,
        body: "body",
    }));
}

function toolsetOf(generator: InMemoryRuleGenerator): RulegenToolset {
    const toolset = generator.toolsets[0];
    if (toolset === undefined) throw new Error("실행기가 도구를 받지 못했다");
    return toolset;
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

        await usecase.execute({...REQUEST, maxRules: 2});

        expect(jobs.reported).toHaveLength(1);
        expect(jobs.reported[0]?.report.proposals).toHaveLength(2);
        expect(jobs.reported[0]?.report.costUsd).toBe(0.1);
        expect(jobs.failed).toEqual([]);
    });

    it("usage가 없으면 결과 보고에서 뺀다", async () => {
        const jobs = new InMemoryRuleJob();
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), new InMemoryRuleGenerator(outcome()), jobs);

        await usecase.execute(REQUEST);

        expect(jobs.reported[0]?.report).not.toHaveProperty("usage");
    });

    it("실행기에 근거를 더 가져오는 도구를 넘긴다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs);

        await usecase.execute(REQUEST);

        expect(Object.keys(toolsetOf(generator))).toEqual(Object.values(RULEGEN_TOOL));
    });

    it("턴 도구를 부르면 그 태스크의 턴을 텍스트로 돌려준다", async () => {
        const evidence = new InMemoryRuleEvidence([{turnIndex: 1, askedText: "테스트 돌려", assistantSummary: "돌렸다"}]);
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob());
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.turns]({taskId: "task-7"});

        expect(evidence.turnCalls).toEqual(["task-7"]);
        expect(text).toContain("테스트 돌려");
    });

    it("이벤트 도구는 상한이 없으면 기본 상한으로 최근 이벤트만 돌려준다", async () => {
        const evidence = new InMemoryRuleEvidence([], events(60));
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob());
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.events]({taskId: "task-1"});

        expect(evidence.eventCalls).toEqual([{taskId: "task-1", limit: RULEGEN_EVENT_LIMIT.fallback}]);
        expect(text).toContain("event 60");
        expect(text).not.toContain("event 10");
    });

    it("이벤트 도구의 상한은 허용 범위 안으로 자른다", async () => {
        const evidence = new InMemoryRuleEvidence([], events(3));
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob());
        await usecase.execute(REQUEST);

        await toolsetOf(generator)[RULEGEN_TOOL.events]({taskId: "task-1", limit: 5_000});

        expect(evidence.eventCalls).toEqual([{taskId: "task-1", limit: RULEGEN_EVENT_LIMIT.max}]);
    });

    it("규칙 도구를 부르면 기존 규칙을 텍스트로 돌려준다", async () => {
        const evidence = new InMemoryRuleEvidence([], [], [{name: "기존 규칙", expect: null}]);
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob());
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.rules]({taskId: "task-1"});

        expect(evidence.ruleCalls).toBe(1);
        expect(text).toContain("기존 규칙");
    });

    it("근거 조회가 서버 오류로 실패하면 도구가 실패 문구로 답한다", async () => {
        const evidence = new InMemoryRuleEvidence();
        vi.spyOn(evidence, "fetchTurns").mockRejectedValue(new RuleEvidenceHttpError("turn context", 503));
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob());
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.turns]({taskId: "task-1"});

        expect(text).toBe("Failed to fetch turns: HTTP 503");
    });

    it("실행기가 오류를 내면 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome({error: "error_max_budget_usd"}));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs);

        await usecase.execute({...REQUEST, jobId: "job-9"});

        expect(jobs.failed).toEqual([{jobId: "job-9", error: "error_max_budget_usd"}]);
        expect(jobs.reported).toEqual([]);
    });

    it("결과 보고가 실패하면 같은 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        jobs.reportOk = false;
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), new InMemoryRuleGenerator(outcome()), jobs);

        await usecase.execute({...REQUEST, jobId: "job-2"});

        expect(jobs.failed).toEqual([{jobId: "job-2", error: "result report failed"}]);
    });

    it("실행이 터지면 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        vi.spyOn(generator, "generate").mockRejectedValue(new Error("SDK 없음"));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs);

        await usecase.execute({...REQUEST, jobId: "job-3"});

        expect(jobs.failed).toEqual([{jobId: "job-3", error: "SDK 없음"}]);
    });

    it("취소된 잡은 실패로 보고하지 않는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        vi.spyOn(generator, "generate").mockRejectedValue(new Error("aborted"));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs);

        await usecase.execute({...REQUEST, jobId: "job-4"}, AbortSignal.abort());

        expect(jobs.failed).toEqual([]);
    });
});
