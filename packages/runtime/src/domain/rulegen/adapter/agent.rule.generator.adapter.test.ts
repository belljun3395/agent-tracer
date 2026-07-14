import {describe, expect, it} from "vitest";
import {AI_JOB_STEP_ROLE} from "@monitor/kernel/job/job.step.const.js";
import {AgentRuleGeneratorAdapter} from "~runtime/domain/rulegen/adapter/agent.rule.generator.adapter.js";
import type {RuleAgentMessage} from "~runtime/domain/rulegen/model/agent.message.model.js";
import {buildRuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import {RULEGEN_TOOL, type RulegenToolset} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import {ScriptedRuleAgentRunner} from "~runtime/domain/rulegen/port/__fakes__/scripted.rule.agent.runner.js";

const SPEC = buildRuleGenerationSpec({jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"});

const TOOLSET: RulegenToolset = {
    [RULEGEN_TOOL.turns]: () => Promise.resolve("turns"),
    [RULEGEN_TOOL.events]: () => Promise.resolve("events"),
    [RULEGEN_TOOL.rules]: () => Promise.resolve("rules"),
};

const USAGE = {inputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheCreationTokens: 1};

const RULE = {name: "테스트 실행", expect: {kind: "command", commandMatches: ["npm test"]}};

function assistant(text: string, toolCalls: {id: string; name: string}[] = []): RuleAgentMessage {
    return {
        type: "assistant",
        text,
        toolCalls: toolCalls.map((call) => ({...call, args: {taskId: "task-1"}})),
        usage: USAGE,
        stopReason: "tool_use",
    };
}

function result(overrides: Partial<Extract<RuleAgentMessage, {type: "result"}>> = {}): RuleAgentMessage {
    return {
        type: "result",
        subtype: "success",
        structuredOutput: {rules: [RULE]},
        errors: [],
        costUsd: 0.25,
        numTurns: 4,
        usage: USAGE,
        ...overrides,
    };
}

function generate(runner: ScriptedRuleAgentRunner, signal: AbortSignal = new AbortController().signal) {
    return new AgentRuleGeneratorAdapter(runner).generate(SPEC, TOOLSET, signal);
}

describe("AgentRuleGeneratorAdapter", () => {
    it("성공 결과에서 제안 후보와 비용과 턴 수를 뽑는다", async () => {
        const outcome = await generate(new ScriptedRuleAgentRunner([result()]));

        expect(outcome.candidates).toEqual([RULE]);
        expect(outcome.costUsd).toBe(0.25);
        expect(outcome.numTurns).toBe(4);
        expect(outcome.usage).toEqual(USAGE);
        expect(outcome.error).toBeNull();
    });

    it("구조화 출력에 rules가 없으면 후보를 비운다", async () => {
        const outcome = await generate(new ScriptedRuleAgentRunner([result({structuredOutput: {}})]));

        expect(outcome.candidates).toEqual([]);
        expect(outcome.error).toBeNull();
    });

    it("실패 결과는 종료 부호와 오류를 합쳐 오류 문구로 만든다", async () => {
        const runner = new ScriptedRuleAgentRunner([
            result({subtype: "error_max_turns", structuredOutput: null, errors: ["turn limit"]}),
        ]);

        const outcome = await generate(runner);

        expect(outcome.error).toBe("error_max_turns: turn limit");
        expect(outcome.candidates).toEqual([]);
    });

    it("실패해도 그때까지 쓴 비용과 궤적을 버리지 않는다", async () => {
        const runner = new ScriptedRuleAgentRunner([
            assistant("턴을 읽는다", [{id: "call-1", name: "get_task_turns"}]),
            result({subtype: "error_max_budget_usd", structuredOutput: null, errors: [], costUsd: 2}),
        ]);

        const outcome = await generate(runner);

        expect(outcome.error).toBe("error_max_budget_usd");
        expect(outcome.costUsd).toBe(2);
        expect(outcome.steps).toHaveLength(1);
    });

    it("결과 메시지가 없이 끝나면 오류로 답한다", async () => {
        const outcome = await generate(new ScriptedRuleAgentRunner([assistant("생각만 했다")]));

        expect(outcome.error).toBe("no result message");
    });

    it("어시스턴트 텍스트와 도구 호출과 도구 응답을 궤적으로 남긴다", async () => {
        const runner = new ScriptedRuleAgentRunner([
            assistant("턴을 읽는다", [{id: "call-1", name: "get_task_turns"}]),
            {type: "tool_result", toolCallId: "call-1", text: "사용자가 테스트를 요구했다"},
            result(),
        ]);

        const outcome = await generate(runner);

        expect(outcome.steps).toEqual([
            {
                seq: 0,
                role: AI_JOB_STEP_ROLE.assistant,
                content: "턴을 읽는다",
                truncated: false,
                toolCalls: [{id: "call-1", name: "get_task_turns", args: {taskId: "task-1"}}],
                inputTokens: 100,
                outputTokens: 20,
                cacheReadTokens: 5,
                cacheCreationTokens: 1,
                stopReason: "tool_use",
            },
            {
                seq: 1,
                role: AI_JOB_STEP_ROLE.tool,
                content: "사용자가 테스트를 요구했다",
                truncated: false,
                toolCalls: [],
                toolName: "get_task_turns",
                toolCallId: "call-1",
            },
        ]);
    });

    it("텍스트도 도구 호출도 없는 응답은 궤적에 남기지 않는다", async () => {
        const outcome = await generate(new ScriptedRuleAgentRunner([assistant(""), result()]));

        expect(outcome.steps).toEqual([]);
    });

    it("중단되면 던지지 않고 그때까지의 궤적과 함께 오류 결과로 답한다", async () => {
        const runner = new ScriptedRuleAgentRunner(
            [assistant("턴을 읽는다", [{id: "call-1", name: "get_task_turns"}]), result()],
            new Error("This operation was aborted"),
        );

        const outcome = await generate(runner, AbortSignal.abort());

        expect(outcome.error).toBe("This operation was aborted");
        expect(outcome.candidates).toEqual([]);
        expect(outcome.steps).toEqual([]);
    });

    it("바깥 신호가 서면 실행기에 넘긴 중단 신호도 함께 선다", async () => {
        const runner = new ScriptedRuleAgentRunner([result()]);

        await generate(runner, AbortSignal.abort());

        expect(runner.requests[0]?.controller.signal.aborted).toBe(true);
    });

    it("실행기에 명세와 도구를 그대로 넘긴다", async () => {
        const runner = new ScriptedRuleAgentRunner([result()]);

        await generate(runner);

        expect(runner.requests[0]?.spec).toBe(SPEC);
        expect(runner.requests[0]?.toolset).toBe(TOOLSET);
    });
});
