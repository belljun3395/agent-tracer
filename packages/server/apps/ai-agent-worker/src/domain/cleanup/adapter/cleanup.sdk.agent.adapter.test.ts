import type { AiJobStepPayload } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { CleanupCandidate } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type { GenerateCleanupSuggestionsInput } from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { CleanupSdkAgentAdapter } from "./cleanup.sdk.agent.adapter.js";
import type { CleanupToolDeps } from "./cleanup.tools.js";

function candidate(id: string): CleanupCandidate {
    return {
        id,
        visibleTitle: "정리해줘",
        status: "running",
        lastEventAt: "2026-07-14T00:00:00Z",
        hasEvents: true,
        activeChildCount: 0,
        candidateReasons: ["placeholder-title"],
    };
}

function suggestion(taskId: string): Record<string, unknown> {
    return { kind: "archive", taskId, rationale: "알맹이가 없다", evidenceEventIds: [] };
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
    if (request.label.endsWith(":triage")) return { inspect: [] };
    const inspectMatch = /:inspect:(.+)$/.exec(request.label);
    if (inspectMatch) return { taskId: inspectMatch[1], archivable: false, reason: "no findings", citedEventIds: [] };
    return { suggestions: [] };
}

interface ScriptedCall {
    readonly data?: unknown;
    readonly override?: RunOverride;
    readonly throws?: string;
}

/** 호출 순서대로 응답을 미리 정해 두며, 스크립트하지 않은 호출은 그 호출 종류에 맞는 빈 값을 낸다. */
class ScriptedRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly requests: AgentQueryRequest<ClaudeQueryOptions>[] = [];

    constructor(private readonly calls: readonly ScriptedCall[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.requests.push(request);
        const scripted = this.calls[this.requests.length - 1];
        if (scripted?.throws !== undefined) return Promise.resolve(errorResult(scripted.throws));
        return Promise.resolve(result(scripted?.data ?? defaultDataFor(request), scripted?.override));
    }
}

const NOOP_DEPS = {} as CleanupToolDeps;

function adapterFor(runner: IQueryRunner<ClaudeQueryOptions>): CleanupSdkAgentAdapter {
    return new CleanupSdkAgentAdapter(runner, NOOP_DEPS);
}

const INPUT: GenerateCleanupSuggestionsInput = {
    jobId: "job-1",
    userId: "u1",
    language: "en",
    scannedAt: "2026-07-14T00:00:00Z",
    candidates: [candidate("task-1")],
    truncated: false,
    maxSuggestions: 5,
};

function assistantStep(seq: number, content: string): AiJobStepPayload {
    return { seq, role: "assistant", content, truncated: false, toolCalls: [] };
}

function plan(...inspect: readonly { taskId: string; weight: number }[]): unknown {
    return { inspect };
}

describe("CleanupSdkAgentAdapter", () => {
    it("계획대로 후보별 조사를 병렬로 띄운다", async () => {
        const runner = new ScriptedRunner([{ data: plan({ taskId: "task-1", weight: 2 }, { taskId: "task-2", weight: 2 }) }]);

        await adapterFor(runner).generate(INPUT);

        const labels = runner.requests.map((request) => request.label);
        expect(labels).toContain("task-cleanup:inspect:task-1");
        expect(labels).toContain("task-cleanup:inspect:task-2");
        const inspectRequest = runner.requests.find((request) => request.label === "task-cleanup:inspect:task-1")!;
        expect(inspectRequest.prompt).toContain("task-1");
        expect(inspectRequest.allowedTools.some((name) => name.includes("list_candidate_tasks"))).toBe(false);
        expect(inspectRequest.allowedTools.some((name) => name.includes("get_task_events"))).toBe(true);
    });

    it("계획이 비면 후보를 열어보지 않고 조율자가 목록만 보고 결정한다", async () => {
        const runner = new ScriptedRunner([{ data: plan() }]);

        await adapterFor(runner).generate(INPUT);

        const labels = runner.requests.map((request) => request.label);
        expect(labels).toEqual(["task-cleanup:triage", "task-cleanup:investigate"]);
        expect(runner.requests[1]!.allowedTools.some((name) => name.includes("list_candidate_tasks"))).toBe(true);
    });

    it("선별 배분의 합이 계약 총량을 넘지 않는다", async () => {
        // 계약 총량 16에서 수리(2)·선별(3)·결정 바닥(3)을 뗀 8이 후보 조사에 배분 가능한 전부다.
        const assignments = Array.from({ length: 20 }, (_, index) => ({ taskId: `task-${index}`, weight: 4 }));
        const runner = new ScriptedRunner([{ data: plan(...assignments) }]);

        await adapterFor(runner).generate(INPUT);

        const inspectRequests = runner.requests.filter((request) => request.label.includes(":inspect:"));
        expect(inspectRequests).toHaveLength(20);
        const grantedRequests = inspectRequests.filter((request) => request.maxTurns > 0);
        const inspectTurns = inspectRequests.reduce((sum, request) => sum + request.maxTurns, 0);
        expect(inspectTurns).toBeLessThanOrEqual(8);
        expect(grantedRequests.length).toBeLessThanOrEqual(8);
        expect(runner.requests[0]!.maxTurns).toBeLessThanOrEqual(3);
    });

    it("후보가 요청보다 적게 턴를 쓰면 남는 턴가 결정으로 흘러간다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ taskId: "task-1", weight: 1 }) },
            { data: { taskId: "task-1", archivable: false, reason: "r", citedEventIds: [] }, override: { numTurns: 1 } },
        ]);

        await adapterFor(runner).generate(INPUT);

        // 예약된 결정 바닥(3) + 후보에게 배분됐던 나머지(8-1=7) = 10.
        expect(runner.requests[2]!.label).toBe("task-cleanup:investigate");
        expect(runner.requests[2]!.maxTurns).toBe(10);
    });

    it("후보 하나의 조사가 무너져도 실행이 살아남고 나머지 후보의 보고를 쓴다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ taskId: "task-1", weight: 4 }, { taskId: "task-2", weight: 3 }) },
            { throws: "agent_execution_error" },
            { data: { taskId: "task-2", archivable: true, reason: "found it", citedEventIds: [] }, override: { numTurns: 2 } },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.suggestions).toEqual([]);
        const investigateRequest = runner.requests.find((request) => request.label === "task-cleanup:investigate")!;
        // 실패한 후보는 예약분 4턴 전부를 쓴 것으로, 살아남은 후보는 실제로 쓴 2턴만 반영된다.
        // 결정 바닥(3) + 남은 턴(8-4-2=2) = 5.
        expect(investigateRequest.maxTurns).toBe(5);
        expect(investigateRequest.prompt).toContain("found it");
    });

    it("열어보지도 않은 태스크를 보관하겠다는 출력은 오류를 돌려주고 한 번만 다시 받는다", async () => {
        const runner = new ScriptedRunner([{ data: plan() }, { data: { suggestions: [suggestion("task-1")] } }, { data: { suggestions: [] } }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(3);
        const repairRequest = runner.requests[2]!;
        expect(repairRequest.prompt).toContain("Deterministic provenance validation rejected part of your output");
        expect(repairRequest.prompt).toContain("unsupported candidate task ID task-1");
        expect(output.suggestions).toEqual([]);
    });

    it("수리한 출력도 근거가 서지 않으면 그 제안을 버린다", async () => {
        const runner = new ScriptedRunner([
            { data: plan() },
            { data: { suggestions: [suggestion("task-1")] } },
            { data: { suggestions: [suggestion("task-1")] } },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.suggestions).toEqual([]);
    });

    it("빈 출력은 옳은 답이므로 다시 묻지 않는다", async () => {
        const runner = new ScriptedRunner([{ data: plan() }, { data: { suggestions: [] } }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(2);
        expect(output.suggestions).toEqual([]);
    });

    it("수리가 예약된 몫으로도 예산을 다 써버리면 잡을 실패시키지 않고 빈 결과로 착지한다", async () => {
        const runner = new ScriptedRunner([
            { data: plan() },
            { data: { suggestions: [suggestion("task-1")] } },
            { throws: "max_turns_exceeded" },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.requests).toHaveLength(3);
        expect(output.suggestions).toEqual([]);
    });

    it("수리 실패가 예산 소진이 아니면 그대로 던진다", async () => {
        const runner = new ScriptedRunner([
            { data: plan() },
            { data: { suggestions: [suggestion("task-1")] } },
            { throws: "output_schema_invalid" },
        ]);

        await expect(adapterFor(runner).generate(INPUT)).rejects.toThrow();
    });

    it("선별과 결정과 수리를 포함한 모든 호출의 비용과 턴과 사용량을 합산해 보고한다", async () => {
        const runner = new ScriptedRunner([
            { data: plan(), override: { costUsd: 0.02, numTurns: 1 } },
            {
                data: { suggestions: [suggestion("task-1")] },
                override: {
                    costUsd: 0.1,
                    numTurns: 3,
                    usage: { inputTokens: 12, outputTokens: 6, cacheReadTokens: 2, cacheCreationTokens: 0 },
                },
            },
            {
                data: { suggestions: [] },
                override: {
                    costUsd: 0.05,
                    numTurns: 2,
                    usage: { inputTokens: 7, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 1 },
                },
            },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.costUsd).toBeCloseTo(0.17);
        expect(output.numTurns).toBe(6);
        expect(output.usage).toEqual({
            inputTokens: 19,
            outputTokens: 8,
            cacheReadTokens: 2,
            cacheCreationTokens: 1,
        });
    });

    it("각 호출의 궤적을 seq 연속으로 이어 붙이고 호출을 낸 노드 이름을 새긴다", async () => {
        const runner = new ScriptedRunner([
            { data: plan({ taskId: "task-1", weight: 2 }), override: { steps: [assistantStep(0, "triage")] } },
            {
                data: { taskId: "task-1", archivable: false, reason: "r", citedEventIds: [] },
                override: { steps: [assistantStep(0, "inspect")] },
            },
            { data: { suggestions: [suggestion("task-1")] }, override: { steps: [assistantStep(0, "investigate")] } },
            { data: { suggestions: [] }, override: { steps: [assistantStep(0, "repair")] } },
        ]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(output.steps.map((step) => step.seq)).toEqual([0, 1, 2, 3]);
        expect(output.steps.map((step) => step.nodeName)).toEqual(["triage", "inspect:task-1", "investigate", "repair"]);
    });
});
