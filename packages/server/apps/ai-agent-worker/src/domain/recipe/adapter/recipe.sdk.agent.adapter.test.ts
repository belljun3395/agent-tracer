import type { AiJobStepPayload } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import {
    type AgentQueryRequest,
    type AgentQueryResult,
    type IQueryRunner,
    type ClaudeQueryOptions,
} from "@monitor/llm-runtime";
import { RECIPE_MCP_SERVER } from "./recipe.sdk.query.js";
import { RECIPE_SCAN_TOOL } from "~ai-agent-worker/domain/recipe/model/recipe.tool.schema.js";
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

function errorResult(errorSubtype: string): AgentQueryResult {
    return {
        rawOutput: "",
        structuredOutput: null,
        durationMs: 1,
        numTurns: 0,
        costUsd: 0,
        usage: null,
        steps: [],
        errorSummary: "boom",
        errorSubtype,
        actualModel: "model-1",
        providerRequestId: null,
    };
}

// label로 어느 호출인지 가려 스크립트하지 않은 호출도 그 호출 종류에 맞는 빈 출력을 낸다.
function defaultDataFor(request: AgentQueryRequest<ClaudeQueryOptions>): unknown {
    if (request.label.endsWith(":survey")) return { probes: [] };
    const probeMatch = /:probe:(\w+)$/.exec(request.label);
    if (probeMatch) return { probe: probeMatch[1], verdict: "no findings", excerpts: [] };
    return { recipes: [] };
}

interface ScriptedCall {
    readonly data?: unknown;
    readonly override?: RunOverride;
    readonly throws?: string;
    readonly onRequest?: (request: AgentQueryRequest<ClaudeQueryOptions>) => Promise<void> | void;
}

/** 호출 순서대로 응답을 미리 정해 두며, 스크립트하지 않은 호출은 그 호출 종류에 맞는 빈 값을 낸다. */
class ScriptedRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly requests: AgentQueryRequest<ClaudeQueryOptions>[] = [];

    constructor(private readonly calls: readonly ScriptedCall[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    async run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.requests.push(request);
        const scripted = this.calls[this.requests.length - 1];
        if (scripted?.onRequest) await scripted.onRequest(request);
        if (scripted?.throws !== undefined) return errorResult(scripted.throws);
        return result(scripted?.data ?? defaultDataFor(request), scripted?.override);
    }
}

interface RegisteredMcpTool {
    readonly handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/** 실제 SDK가 등록한 도구 핸들러를 직접 불러, 전문가가 조사 중 도구를 부른 상황을 흉내 낸다. */
async function invokeProbeTool(
    request: AgentQueryRequest<ClaudeQueryOptions>,
    toolName: string,
    args: Record<string, unknown>,
): Promise<void> {
    const server = request.providerOptions?.mcpServers?.[RECIPE_MCP_SERVER];
    const instance = (server as unknown as { instance?: { _registeredTools: Record<string, RegisteredMcpTool> } })
        .instance;
    await instance?._registeredTools[toolName]?.handler(args);
}

const NOOP_DEPS = {} as RecipeToolDeps;

function adapterFor(runner: IQueryRunner<ClaudeQueryOptions>, deps: RecipeToolDeps = NOOP_DEPS): RecipeSdkAgentAdapter {
    return new RecipeSdkAgentAdapter(runner, deps);
}

const INPUT = { userId: "u1", taskId: ANCHOR, language: "en" as const, jobId: "job-1" };

function assistantStep(seq: number, content: string): AiJobStepPayload {
    return { seq, role: "assistant", content, truncated: false, toolCalls: [] };
}

function plan(...probes: readonly { probe: string; weight: number; question: string }[]): unknown {
    return { probes };
}

describe("RecipeSdkAgentAdapter", () => {
    it("계획대로 전문가를 병렬로 띄운다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ probe: "timeline", weight: 2, question: "what happened" }, { probe: "rules", weight: 3, question: "which rules" }) },
        ]);

        await adapterFor(runner).generate(INPUT);

        const labels = runner.requests.map((request) => request.label);
        expect(labels).toContain("recipe-scan:probe:timeline");
        expect(labels).toContain("recipe-scan:probe:rules");
        expect(labels).not.toContain("recipe-scan:probe:repetition");
        const timelineRequest = runner.requests.find((request) => request.label === "recipe-scan:probe:timeline")!;
        expect(timelineRequest.prompt).toContain("what happened");
        expect(timelineRequest.allowedTools.some((name) => name.includes("list_rules"))).toBe(false);
        expect(timelineRequest.allowedTools.some((name) => name.includes("get_task_events"))).toBe(true);
    });

    it("계획이 비면 전문가 없이 조율자가 혼자 조사한다", async () => {
        const runner = new ScriptedRunner([{ data: plan() }]);

        await adapterFor(runner).generate(INPUT);

        const labels = runner.requests.map((request) => request.label);
        expect(labels).toEqual(["recipe-scan:survey", "recipe-scan:investigate"]);
        const investigateRequest = runner.requests[1]!;
        expect(investigateRequest.prompt).not.toContain("Your own plan");
    });

    it("전문가 배분의 합이 계약 총량을 넘지 않는다", async () => {
        // 계약 총량 15에서 수리(2)·계획(1)·종합 바닥(3)을 뗀 9가 전문가에게 배분 가능한 전부다.
        const runner = new ScriptedRunner([
            {
                data: plan(
                    { probe: "timeline", weight: 10, question: "a" },
                    { probe: "rules", weight: 10, question: "b" },
                    { probe: "repetition", weight: 10, question: "c" },
                ),
            },
        ]);

        await adapterFor(runner).generate(INPUT);

        const probeRequests = runner.requests.filter((request) => request.label.includes(":probe:"));
        expect(probeRequests).toHaveLength(3);
        expect(probeRequests.every((request) => request.maxTurns >= 1)).toBe(true);
        const probeTurns = probeRequests.reduce((sum, request) => sum + request.maxTurns, 0);
        expect(probeTurns).toBeLessThanOrEqual(9);
        expect(runner.requests[0]!.maxTurns).toBeLessThanOrEqual(1);
    });

    it("전문가가 요청보다 적게 턴를 쓰면 남는 턴가 종합으로 흘러간다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ probe: "timeline", weight: 1, question: "a" }) },
            { data: { probe: "timeline", verdict: "v", excerpts: [] }, override: { numTurns: 1 } },
        ]);

        await adapterFor(runner).generate(INPUT);

        // 예약된 종합 바닥(3) + 전문가에게 배분됐던 나머지(9-1=8) = 11.
        expect(runner.requests[2]!.label).toBe("recipe-scan:investigate");
        expect(runner.requests[2]!.maxTurns).toBe(11);
    });

    it("전문가 하나가 무너져도 실행이 살아남고 나머지 전문가의 보고를 쓴다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ probe: "timeline", weight: 5, question: "a" }, { probe: "rules", weight: 4, question: "b" }) },
            { throws: "agent_execution_error" },
            { data: { probe: "rules", verdict: "found it", excerpts: [] }, override: { numTurns: 2 } },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.recipes).toEqual([]);
        const investigateRequest = runner.requests.find((request) => request.label === "recipe-scan:investigate")!;
        // 실패한 전문가는 예약분 5턴 전부를 쓴 것으로, 살아남은 전문가는 실제로 쓴 2턴만 반영된다.
        // 종합 바닥(3) + 남은 턴(9-5-2=2) = 5.
        expect(investigateRequest.maxTurns).toBe(5);
        expect(investigateRequest.prompt).toContain("found it");
    });

    it("전문가가 관측한 이벤트를 조율자 장부로 합쳐야 종합의 인용이 통과한다", async () => {
        const task = { id: ANCHOR, userId: "u1" };
        const event = {
            id: "event-9",
            seq: "1",
            turnId: "turn-1",
            kind: "execute_tool",
            title: "x",
            body: null,
            toolName: null,
            filePaths: [],
            occurredAt: new Date("2026-07-14T00:00:00.000Z"),
        };
        const deps = {
            tasks: { findById: async (id: string) => (id === ANCHOR ? task : null) },
            events: {
                findTimeline: async () => [event],
                findTimelineWindow: async () => [event],
                countByTask: async () => 1,
            },
            rules: {},
            search: {},
        } as unknown as RecipeToolDeps;

        const runner = new ScriptedRunner([
            { data: plan({ probe: "timeline", weight: 3, question: "what happened" }) },
            {
                data: { probe: "timeline", verdict: "found the correction", excerpts: [] },
                onRequest: (request) => invokeProbeTool(request, RECIPE_SCAN_TOOL.getTaskEvents, { taskId: ANCHOR }),
            },
            { data: { recipes: [recipe("event-9")] } },
        ]);

        const output = await adapterFor(runner, deps).generate(INPUT);

        expect(runner.requests).toHaveLength(3);
        expect(output.recipes).toHaveLength(1);
        expect(output.provenance?.eventIdsByTask[ANCHOR]).toContain("event-9");
    });

    it("근거가 서지 않는 인용을 받으면 오류를 돌려주고 한 번만 다시 받는다", async () => {
        const runner = new ScriptedRunner([{ data: plan() }, { data: { recipes: [recipe("event-9")] } }, { data: { recipes: [] } }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(3);
        const repairRequest = runner.requests[2]!;
        expect(repairRequest.prompt).toContain("Deterministic provenance validation rejected your output");
        expect(repairRequest.prompt).toContain("Unsupported event IDs");
        expect(output.recipes).toEqual([]);
    });

    it("수리한 출력도 근거가 서지 않으면 후보를 버린다", async () => {
        const runner = new ScriptedRunner([
            { data: plan() },
            { data: { recipes: [recipe("event-9")] } },
            { data: { recipes: [recipe("event-8")] } },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.recipes).toEqual([]);
    });

    it("빈 출력은 옳은 답이므로 다시 묻지 않는다", async () => {
        const runner = new ScriptedRunner([{ data: plan() }, { data: { recipes: [] } }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(2);
        expect(output.recipes).toEqual([]);
    });

    it("수리가 예약된 몫으로도 예산을 다 써버리면 잡을 실패시키지 않고 빈 결과로 착지한다", async () => {
        const runner = new ScriptedRunner([
            { data: plan() },
            { data: { recipes: [recipe("event-9")] } },
            { throws: "max_turns_exceeded" },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(3);
        expect(output.recipes).toEqual([]);
    });

    it("수리 실패가 예산 소진이 아니면 그대로 던진다", async () => {
        const runner = new ScriptedRunner([
            { data: plan() },
            { data: { recipes: [recipe("event-9")] } },
            { throws: "output_schema_invalid" },
        ]);

        await expect(adapterFor(runner).generate(INPUT)).rejects.toThrow();
    });

    it("계획과 종합과 수리를 포함한 모든 호출의 비용과 턴과 사용량을 합산해 보고한다", async () => {
        const runner = new ScriptedRunner([
            { data: plan(), override: { costUsd: 0.05, numTurns: 1 } },
            {
                data: { recipes: [recipe("event-9")] },
                override: {
                    costUsd: 0.3,
                    numTurns: 4,
                    usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheCreationTokens: 0 },
                },
            },
            {
                data: { recipes: [] },
                override: {
                    costUsd: 0.1,
                    numTurns: 2,
                    usage: { inputTokens: 6, outputTokens: 3, cacheReadTokens: 0, cacheCreationTokens: 1 },
                },
            },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.costUsd).toBeCloseTo(0.45);
        expect(output.numTurns).toBe(7);
        expect(output.usage).toEqual({
            inputTokens: 16,
            outputTokens: 8,
            cacheReadTokens: 1,
            cacheCreationTokens: 1,
        });
    });

    it("각 호출의 궤적을 seq 연속으로 이어 붙이고 호출을 낸 노드 이름을 새긴다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ probe: "timeline", weight: 3, question: "a" }), override: { steps: [assistantStep(0, "survey")] } },
            { data: { probe: "timeline", verdict: "v", excerpts: [] }, override: { steps: [assistantStep(0, "probe")] } },
            {
                data: { recipes: [recipe("event-9")] },
                override: { steps: [assistantStep(0, "investigate"), assistantStep(1, "investigate-2")] },
            },
            { data: { recipes: [] }, override: { steps: [assistantStep(0, "repair")] } },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.steps.map((step) => step.seq)).toEqual([0, 1, 2, 3, 4]);
        expect(output.steps.map((step) => step.nodeName)).toEqual([
            "survey",
            "probe:timeline",
            "investigate",
            "investigate",
            "repair",
        ]);
    });
});
