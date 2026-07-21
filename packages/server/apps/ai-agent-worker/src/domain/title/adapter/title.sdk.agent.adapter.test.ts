import type { AiJobStepPayload } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { TitleContext } from "~ai-agent-worker/domain/title/model/title.context.model.js";
import type { TitleToolDeps } from "./title.tools.js";
import { TitleSdkAgentAdapter } from "./title.sdk.agent.adapter.js";

const CONTEXT: TitleContext = {
    title: "Untitled",
    status: "completed",
    totalEventCount: 10,
    totalTurnCount: 2,
    truncated: false,
    turns: [{ turnIndex: 0, askedText: "fix the auth token leak", assistantText: "done" }],
};

const VALID = {
    suggestions: [
        { title: "Fix auth middleware token leak", rationale: "the leak fix drove the task" },
        { title: "Add auth regression test", rationale: "a regression test was added" },
    ],
};

function suggestions(...titles: readonly string[]): Record<string, unknown> {
    return { suggestions: titles.map((title) => ({ title, rationale: "why" })) };
}

interface RunOverride {
    readonly durationMs?: number;
    readonly numTurns?: number | null;
    readonly costUsd?: number | null;
    readonly usage?: AgentQueryResult["usage"];
    readonly steps?: AgentQueryResult["steps"];
}

function result(structuredOutput: unknown, override: RunOverride = {}): AgentQueryResult {
    return {
        rawOutput: JSON.stringify(structuredOutput),
        structuredOutput,
        durationMs: override.durationMs ?? 1,
        numTurns: override.numTurns ?? 1,
        costUsd: override.costUsd ?? 0,
        usage: override.usage ?? null,
        steps: override.steps ?? [],
        errorSummary: null,
        errorSubtype: null,
        actualModel: "model-1",
        providerRequestId: null,
    };
}

class ScriptedRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly prompts: string[] = [];
    readonly requests: AgentQueryRequest<ClaudeQueryOptions>[] = [];

    constructor(private readonly outputs: readonly [unknown, RunOverride?][]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.prompts.push(request.prompt);
        this.requests.push(request);
        const [structuredOutput, override] = this.outputs[this.requests.length - 1] ?? [{ suggestions: [] }];
        return Promise.resolve(result(structuredOutput, override));
    }
}

/** 첫 호출은 지정한 제안을 내고 두 번째 호출(수리)은 공급자 오류로 실패한다. */
class FailingSecondCallRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly requests: AgentQueryRequest<ClaudeQueryOptions>[] = [];

    constructor(
        private readonly firstOutput: unknown,
        private readonly secondErrorSubtype: string,
    ) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.requests.push(request);
        if (this.requests.length === 1) return Promise.resolve(result(this.firstOutput));
        return Promise.resolve({
            rawOutput: "",
            structuredOutput: null,
            durationMs: 1,
            numTurns: 0,
            costUsd: 0,
            usage: null,
            steps: [],
            errorSummary: "boom",
            errorSubtype: this.secondErrorSubtype,
            actualModel: "model-1",
            providerRequestId: null,
        });
    }
}

function adapterFor(runner: IQueryRunner<ClaudeQueryOptions>): TitleSdkAgentAdapter {
    return new TitleSdkAgentAdapter(runner, {} as TitleToolDeps);
}

const INPUT = {
    userId: "u1",
    taskId: "task-1",
    language: "en" as const,
    jobId: "job-1",
    context: CONTEXT,
};

function assistantStep(seq: number, content: string): AiJobStepPayload {
    return { seq, role: "assistant", content, truncated: false, toolCalls: [] };
}

describe("TitleSdkAgentAdapter", () => {
    it("자리표시자 제목을 받으면 오류를 돌려주고 한 번만 다시 받는다", async () => {
        const runner = new ScriptedRunner([[suggestions("Task 123", "Untitled")], [VALID]]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(runner.prompts[1]).toContain("Deterministic validation rejected your output");
        expect(runner.prompts[1]).toContain("is a placeholder title");
        expect(output.suggestions).toEqual(VALID.suggestions);
    });

    it("수리한 출력도 제약을 어기면 제안을 버린다", async () => {
        const runner = new ScriptedRunner([
            [suggestions("Task 123", "Untitled")],
            [suggestions("Test", "Task 7")],
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(output.suggestions).toEqual([]);
    });

    it("빈 출력은 옳은 답이므로 다시 묻지 않는다", async () => {
        const runner = new ScriptedRunner([[{ suggestions: [] }]]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(1);
        expect(output.suggestions).toEqual([]);
    });

    it("수리 실행이 계약 총량이 아니라 예약해 둔 몫만 받는다", async () => {
        const runner = new ScriptedRunner([
            [suggestions("Task 123", "Untitled"), { numTurns: 1, costUsd: 0.05 }],
            [VALID],
        ]);

        await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(2);
        const [firstRequest, secondRequest] = runner.requests;
        expect(firstRequest!.maxTurns).toBe(3);
        expect(firstRequest!.maxBudgetUsd).toBeCloseTo(0.16);
        expect(secondRequest!.maxTurns).toBe(1);
        expect(secondRequest!.maxBudgetUsd).toBeCloseTo(0.04);
    });

    it("첫 실행이 예산을 거의 다 써도 예약해 둔 수리 몫은 살아남아 잡 전체가 실패하지 않는다", async () => {
        const runner = new ScriptedRunner([
            [suggestions("Task 123", "Untitled"), { numTurns: 3, costUsd: 0.16 }],
            [VALID],
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(2);
        expect(runner.requests[1]!.maxTurns).toBe(1);
        expect(output.suggestions).toEqual(VALID.suggestions);
    });

    it("수리가 예약된 몫으로도 예산을 다 써버리면 잡을 실패시키지 않고 빈 결과로 착지한다", async () => {
        const runner = new FailingSecondCallRunner(suggestions("Task 123", "Untitled"), "max_turns_exceeded");

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(2);
        expect(output.suggestions).toEqual([]);
    });

    it("수리 실패가 예산 소진이 아니면 그대로 던진다", async () => {
        const runner = new FailingSecondCallRunner(suggestions("Task 123", "Untitled"), "output_schema_invalid");

        await expect(adapterFor(runner).generate(INPUT)).rejects.toThrow();
    });

    it("두 실행의 비용과 턴과 사용량을 합산해 보고한다", async () => {
        const runner = new ScriptedRunner([
            [
                suggestions("Task 123", "Untitled"),
                {
                    costUsd: 0.03,
                    numTurns: 1,
                    usage: { inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
                },
            ],
            [
                VALID,
                {
                    costUsd: 0.02,
                    numTurns: 1,
                    usage: { inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 },
                },
            ],
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.costUsd).toBeCloseTo(0.05);
        expect(output.numTurns).toBe(2);
        expect(output.usage).toEqual({
            inputTokens: 7,
            outputTokens: 3,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
        });
    });

    it("첫 실행과 수리 실행의 궤적을 seq 연속으로 이어 붙이고 노드 이름을 새긴다", async () => {
        const runner = new ScriptedRunner([
            [suggestions("Task 123", "Untitled"), { steps: [assistantStep(0, "first")] }],
            [VALID, { steps: [assistantStep(0, "repair-1"), assistantStep(1, "repair-2")] }],
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.steps.map((step) => step.seq)).toEqual([0, 1, 2]);
        expect(output.steps.map((step) => step.nodeName)).toEqual(["investigate", "repair", "repair"]);
    });
});
