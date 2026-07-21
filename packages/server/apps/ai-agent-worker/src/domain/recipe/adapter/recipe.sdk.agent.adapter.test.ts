import { describe, expect, it } from "vitest";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { RecipeToolDeps } from "./recipe.tools.js";
import { RecipeSdkAgentAdapter } from "./recipe.sdk.agent.adapter.js";

const ANCHOR = "task-1";

function recipe(eventId: string): Record<string, unknown> {
    return {
        title: "Add a migration",
        intent: "migration",
        description: "d",
        summary_md: "s",
        request: "r",
        rationale: "why",
        steps: [],
        touched_files: [],
        contributing_slices: [{ taskId: ANCHOR, turnIds: [], eventIds: [eventId] }],
    };
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

/** 도구를 부르지 않으므로 근거 장부가 비고, 모델이 낸 모든 인용은 근거가 서지 않는다. */
class ScriptedRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly prompts: string[] = [];
    readonly requests: AgentQueryRequest<ClaudeQueryOptions>[] = [];

    constructor(private readonly outputs: readonly unknown[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.requests.push(request);
        this.prompts.push(request.prompt);
        return Promise.resolve(result(this.outputs[this.prompts.length - 1] ?? { recipes: [] }));
    }
}

function adapterFor(runner: ScriptedRunner): RecipeSdkAgentAdapter {
    return new RecipeSdkAgentAdapter(runner, {} as RecipeToolDeps);
}

const INPUT = { userId: "u1", taskId: ANCHOR, language: "en" as const, jobId: "job-1" };

describe("RecipeSdkAgentAdapter", () => {
    it("근거가 서지 않는 인용을 받으면 오류를 돌려주고 한 번만 다시 받는다", async () => {
        const runner = new ScriptedRunner([{ recipes: [recipe("event-9")] }, { recipes: [] }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(runner.prompts[1]).toContain("Deterministic provenance validation rejected your output");
        expect(runner.prompts[1]).toContain("Unsupported event IDs");
        expect(output.recipes).toEqual([]);
    });

    it("수리한 출력도 근거가 서지 않으면 후보를 버린다", async () => {
        const runner = new ScriptedRunner([
            { recipes: [recipe("event-9")] },
            { recipes: [recipe("event-8")] },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(output.recipes).toEqual([]);
    });

    it("빈 출력은 옳은 답이므로 다시 묻지 않는다", async () => {
        const runner = new ScriptedRunner([{ recipes: [] }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(1);
        expect(output.recipes).toEqual([]);
    });

    it("조사를 SDK 네이티브 서브에이전트에 분해한다", async () => {
        const runner = new ScriptedRunner([{ recipes: [] }]);

        await adapterFor(runner).generate(INPUT);

        const request = runner.requests[0];
        expect(request?.allowedTools).toContain("Agent");
        // 리드는 근거를 직접 캐지 않으므로 조사 도구는 없고 인용 확인만 남는다.
        expect(request?.allowedTools.some((tool) => tool.includes("check_citations"))).toBe(true);
        expect(request?.allowedTools.some((tool) => tool.includes("get_task_events"))).toBe(false);
        expect(request?.allowedTools.some((tool) => tool.includes("get_task_summary"))).toBe(false);
        expect(request?.providerOptions?.builtInTools).toEqual(["Agent"]);
        expect(Object.keys(request?.providerOptions?.agents ?? {})).toEqual([
            "timeline",
            "rules",
            "repetition",
        ]);
        expect(request?.providerOptions?.agents?.["timeline"]?.tools).toEqual(
            expect.arrayContaining([
                expect.stringContaining("get_task_summary"),
                expect.stringContaining("get_task_events"),
                expect.stringContaining("check_citations"),
            ]),
        );
        expect(request?.providerOptions?.agents?.["timeline"]?.prompt).toContain('"probe":"timeline"');
        expect(request?.providerOptions?.agents?.["timeline"]).toMatchObject({
            maxTurns: 10,
            permissionMode: "bypassPermissions",
        });
        expect(request?.providerOptions?.agents?.["timeline"]?.model).toBe(request?.model);
    });
});
