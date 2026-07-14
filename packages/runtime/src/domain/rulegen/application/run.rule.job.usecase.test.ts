import {describe, expect, it, vi, afterEach} from "vitest";
import {AI_JOB_STEP_ROLE, type AiJobStepPayload} from "@monitor/kernel/job/job.step.const.js";
import {RunRuleJobUsecase} from "~runtime/domain/rulegen/application/run.rule.job.usecase.js";
import {FixedClock} from "~runtime/domain/rulegen/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");
import type {EventEvidence, TurnDigest} from "~runtime/domain/rulegen/model/evidence.model.js";
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

const TURN: TurnDigest = {turnId: "turn-1", turnIndex: 1, askedText: "테스트 돌려", assistantSummary: "돌렸다"};

const EVENT: EventEvidence = {
    eventId: "event-1",
    turnId: "turn-1",
    kind: "execute_tool",
    title: "npm test",
    body: "통과",
};

const VALID_RULE = {
    name: "테스트 실행",
    expect: {kind: "command", commandMatches: ["npm test"]},
    rationale: "사용자가 요구했다",
    citedTurnIds: [TURN.turnId],
    citedEventIds: [EVENT.eventId],
};

const INVENTED_RULE = {...VALID_RULE, citedEventIds: ["event-999"]};

const REQUEST = {jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"};

const STEP: AiJobStepPayload = {
    seq: 0,
    role: AI_JOB_STEP_ROLE.assistant,
    content: "턴을 읽는다",
    truncated: false,
    toolCalls: [{id: "call-1", name: "get_task_turns", args: {taskId: "task-1"}}],
};

const USAGE = {inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0};

function outcome(overrides: Partial<RuleGenerationOutcome> = {}): RuleGenerationOutcome {
    return {candidates: [], costUsd: 0.1, numTurns: 2, usage: null, steps: [], error: null, ...overrides};
}

function events(count: number): EventEvidence[] {
    return Array.from({length: count}, (_, index) => ({
        eventId: `event-${index + 1}`,
        kind: "execute_tool",
        title: `event ${index + 1}`,
        body: "body",
    }));
}

/** 근거 장부는 도구 응답만 먹으므로 인용을 세우려면 모델이 도구를 부른 것으로 대본을 짠다. */
function pullingEvidence(generator: InMemoryRuleGenerator): InMemoryRuleGenerator {
    generator.pulls.push(
        {tool: RULEGEN_TOOL.turns, input: {taskId: "task-1"}},
        {tool: RULEGEN_TOOL.events, input: {taskId: "task-1"}},
    );
    return generator;
}

function groundedEvidence(): InMemoryRuleEvidence {
    return new InMemoryRuleEvidence([TURN], [EVENT]);
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
    it("계약에 맞고 근거가 선 제안만 상한까지 결과로 보고한다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = pullingEvidence(
            new InMemoryRuleGenerator(outcome({candidates: [VALID_RULE, VALID_RULE, VALID_RULE]})),
        );
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, maxRules: 2});

        expect(jobs.reported).toHaveLength(1);
        expect(jobs.reported[0]?.report.proposals).toHaveLength(2);
        expect(jobs.reported[0]?.report.costUsd).toBe(0.1);
        expect(generator.specs).toHaveLength(1);
        expect(jobs.failed).toEqual([]);
    });

    it("usage가 없으면 결과 보고에서 뺀다", async () => {
        const jobs = new InMemoryRuleJob();
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), new InMemoryRuleGenerator(outcome()), jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(jobs.reported[0]?.report).not.toHaveProperty("usage");
    });

    it("결과 보고에 실행 궤적을 싣는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome({steps: [STEP], usage: USAGE}));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(jobs.reported[0]?.report.steps).toEqual([STEP]);
        expect(jobs.reported[0]?.report.usage).toEqual(USAGE);
    });

    it("실행기에 근거를 더 가져오는 도구를 넘긴다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(Object.keys(toolsetOf(generator))).toEqual(Object.values(RULEGEN_TOOL));
    });

    it("턴 도구를 부르면 그 태스크의 턴을 인용할 식별자와 함께 돌려준다", async () => {
        const evidence = groundedEvidence();
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob(), new FixedClock(NOW));
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.turns]({taskId: "task-7"});

        expect(evidence.turnCalls).toEqual(["task-7"]);
        expect(text).toContain("테스트 돌려");
        expect(text).toContain("turn-1");
    });

    it("이벤트 도구는 상한이 없으면 기본 상한으로 최근 이벤트만 돌려준다", async () => {
        const evidence = new InMemoryRuleEvidence([], events(60));
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob(), new FixedClock(NOW));
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.events]({taskId: "task-1"});

        expect(evidence.eventCalls).toEqual([{taskId: "task-1", limit: RULEGEN_EVENT_LIMIT.fallback}]);
        expect(text).toContain("event 60");
        expect(text).not.toContain("event 10");
    });

    it("이벤트 도구의 상한은 허용 범위 안으로 자른다", async () => {
        const evidence = new InMemoryRuleEvidence([], events(3));
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob(), new FixedClock(NOW));
        await usecase.execute(REQUEST);

        await toolsetOf(generator)[RULEGEN_TOOL.events]({taskId: "task-1", limit: 5_000});

        expect(evidence.eventCalls).toEqual([{taskId: "task-1", limit: RULEGEN_EVENT_LIMIT.max}]);
    });

    it("규칙 도구를 부르면 기존 규칙을 텍스트로 돌려준다", async () => {
        const evidence = new InMemoryRuleEvidence([], [], [{name: "기존 규칙", expect: null}]);
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob(), new FixedClock(NOW));
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.rules]({taskId: "task-1"});

        expect(evidence.ruleCalls).toBe(1);
        expect(text).toContain("기존 규칙");
    });

    it("근거 조회가 서버 오류로 실패하면 도구가 실패 문구로 답한다", async () => {
        const evidence = new InMemoryRuleEvidence();
        vi.spyOn(evidence, "fetchTurns").mockRejectedValue(new RuleEvidenceHttpError("turn context", 503));
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(evidence, generator, new InMemoryRuleJob(), new FixedClock(NOW));
        await usecase.execute(REQUEST);

        const text = await toolsetOf(generator)[RULEGEN_TOOL.turns]({taskId: "task-1"});

        expect(text).toBe("Failed to fetch turns: HTTP 503");
    });

    it("도구가 돌려준 적 없는 이벤트를 인용하면 오류를 돌려주고 한 번 다시 받는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = pullingEvidence(new InMemoryRuleGenerator(
            outcome({candidates: [INVENTED_RULE]}),
            outcome({candidates: [VALID_RULE]}),
        ));
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(generator.specs).toHaveLength(2);
        expect(generator.specs[1]?.userPrompt).toContain("event-999");
        expect(generator.specs[1]?.userPrompt).toContain("Deterministic validation rejected it");
        expect(jobs.reported[0]?.report.proposals).toEqual([VALID_RULE]);
    });

    it("수리 뒤에도 지어낸 식별자를 인용하면 그 제안을 버리고 빈 결과를 보고한다", async () => {
        vi.spyOn(process.stderr, "write").mockReturnValue(true);
        const jobs = new InMemoryRuleJob();
        const generator = pullingEvidence(new InMemoryRuleGenerator(
            outcome({candidates: [INVENTED_RULE], costUsd: 0.1, steps: [STEP]}),
            outcome({candidates: [INVENTED_RULE], costUsd: 0.2, steps: [STEP]}),
        ));
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(generator.specs).toHaveLength(2);
        expect(jobs.reported[0]?.report.proposals).toEqual([]);
        expect(jobs.reported[0]?.report.costUsd).toBeCloseTo(0.3);
        expect(jobs.reported[0]?.report.steps.map((step) => step.seq)).toEqual([0, 1]);
        expect(jobs.failed).toEqual([]);
    });

    it("도구를 부르지 않았다면 실재하는 식별자를 인용해도 근거가 서지 않는다", async () => {
        vi.spyOn(process.stderr, "write").mockReturnValue(true);
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome({candidates: [VALID_RULE]}));
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(generator.specs).toHaveLength(2);
        expect(jobs.reported[0]?.report.proposals).toEqual([]);
    });

    it("인용한 턴이 하나도 없는 제안도 근거가 서지 않은 것으로 본다", async () => {
        vi.spyOn(process.stderr, "write").mockReturnValue(true);
        const jobs = new InMemoryRuleJob();
        const generator = pullingEvidence(new InMemoryRuleGenerator(
            outcome({candidates: [{...VALID_RULE, citedTurnIds: []}]}),
        ));
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(generator.specs[1]?.userPrompt).toContain("citedTurnIds is empty");
        expect(jobs.reported[0]?.report.proposals).toEqual([]);
    });

    it("스키마를 어긴 제안도 사유를 돌려주고 한 번 다시 받는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = pullingEvidence(new InMemoryRuleGenerator(
            outcome({candidates: [{name: "검증 불가", expect: {}}]}),
            outcome({candidates: [VALID_RULE]}),
        ));
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute(REQUEST);

        expect(generator.specs[1]?.userPrompt).toContain("violates the output schema: invalid expect");
        expect(jobs.reported[0]?.report.proposals).toEqual([VALID_RULE]);
    });

    it("실행기가 오류를 내면 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome({error: "error_max_budget_usd"}));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, jobId: "job-9"});

        expect(jobs.failed).toEqual([{jobId: "job-9", error: "error_max_budget_usd"}]);
        expect(jobs.reported).toEqual([]);
    });

    it("수리 실행이 오류를 내면 두 실행의 비용을 합쳐 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = pullingEvidence(new InMemoryRuleGenerator(
            outcome({candidates: [INVENTED_RULE], costUsd: 0.1}),
            outcome({error: "error_max_turns", costUsd: 0.2}),
        ));
        const usecase = new RunRuleJobUsecase(groundedEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, jobId: "job-7"});

        expect(jobs.failures[0]?.failure).toMatchObject({error: "error_max_turns"});
        expect(jobs.failures[0]?.failure.costUsd).toBeCloseTo(0.3);
    });

    it("실패한 실행이 쓴 비용과 궤적도 실패 보고에 싣는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(
            outcome({error: "error_max_turns", costUsd: 0.42, numTurns: 15, usage: USAGE, steps: [STEP]}),
        );
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, jobId: "job-8"});

        expect(jobs.failures[0]?.failure).toMatchObject({
            error: "error_max_turns",
            costUsd: 0.42,
            numTurns: 15,
            usage: USAGE,
            steps: [STEP],
        });
    });

    it("결과 보고가 실패하면 같은 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        jobs.reportOk = false;
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), new InMemoryRuleGenerator(outcome()), jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, jobId: "job-2"});

        expect(jobs.failed).toEqual([{jobId: "job-2", error: "result report failed"}]);
    });

    it("실행이 터지면 잡을 실패로 종결시킨다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        vi.spyOn(generator, "generate").mockRejectedValue(new Error("SDK 없음"));
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, jobId: "job-3"});

        expect(jobs.failed).toEqual([{jobId: "job-3", error: "SDK 없음"}]);
    });

    it("취소된 잡은 실행기가 오류 결과로 답해도 실패로 보고하지 않는다", async () => {
        const jobs = new InMemoryRuleJob();
        const generator = new InMemoryRuleGenerator(outcome());
        const usecase = new RunRuleJobUsecase(new InMemoryRuleEvidence(), generator, jobs, new FixedClock(NOW));

        await usecase.execute({...REQUEST, jobId: "job-4"}, AbortSignal.abort());

        expect(jobs.failed).toEqual([]);
        expect(jobs.reported).toEqual([]);
    });
});
