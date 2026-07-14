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

function result(structuredOutput: unknown): AgentQueryResult {
    return {
        rawOutput: JSON.stringify(structuredOutput),
        structuredOutput,
        durationMs: 1,
        numTurns: 1,
        costUsd: 0,
        usage: null,
        steps: [],
        errorSummary: null,
        errorSubtype: null,
        actualModel: "model-1",
        providerRequestId: null,
    };
}

class ScriptedRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly prompts: string[] = [];

    constructor(private readonly outputs: readonly unknown[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.prompts.push(request.prompt);
        return Promise.resolve(result(this.outputs[this.prompts.length - 1] ?? { suggestions: [] }));
    }
}

function adapterFor(runner: ScriptedRunner): TitleSdkAgentAdapter {
    return new TitleSdkAgentAdapter(runner, {} as TitleToolDeps);
}

const INPUT = {
    userId: "u1",
    taskId: "task-1",
    language: "en" as const,
    jobId: "job-1",
    context: CONTEXT,
};

describe("TitleSdkAgentAdapter", () => {
    it("자리표시자 제목을 받으면 오류를 돌려주고 한 번만 다시 받는다", async () => {
        const runner = new ScriptedRunner([suggestions("Task 123", "Untitled"), VALID]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(runner.prompts[1]).toContain("Deterministic validation rejected your output");
        expect(runner.prompts[1]).toContain("is a placeholder title");
        expect(output.suggestions).toEqual(VALID.suggestions);
    });

    it("수리한 출력도 제약을 어기면 제안을 버린다", async () => {
        const runner = new ScriptedRunner([
            suggestions("Task 123", "Untitled"),
            suggestions("Test", "Task 7"),
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(output.suggestions).toEqual([]);
    });

    it("빈 출력은 옳은 답이므로 다시 묻지 않는다", async () => {
        const runner = new ScriptedRunner([{ suggestions: [] }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(1);
        expect(output.suggestions).toEqual([]);
    });
});
