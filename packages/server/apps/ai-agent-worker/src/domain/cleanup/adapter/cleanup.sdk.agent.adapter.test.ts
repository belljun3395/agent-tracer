import { describe, expect, it } from "vitest";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { CleanupCandidate } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type { GenerateCleanupSuggestionsInput } from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { CleanupSdkAgentAdapter } from "./cleanup.sdk.agent.adapter.js";
import type { CleanupToolDeps } from "./cleanup.tools.js";

const CANDIDATE: CleanupCandidate = {
    id: "task-1",
    visibleTitle: "정리해줘",
    status: "running",
    lastEventAt: "2026-07-14T00:00:00Z",
    hasEvents: true,
    activeChildCount: 0,
    candidateReasons: ["placeholder-title"],
};

function suggestion(taskId: string): Record<string, unknown> {
    return { kind: "archive", taskId, rationale: "알맹이가 없다", evidenceEventIds: [] };
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

    constructor(private readonly outputs: readonly unknown[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        this.prompts.push(request.prompt);
        return Promise.resolve(result(this.outputs[this.prompts.length - 1] ?? { suggestions: [] }));
    }
}

const INPUT: GenerateCleanupSuggestionsInput = {
    jobId: "job-1",
    userId: "u1",
    language: "en",
    scannedAt: "2026-07-14T00:00:00Z",
    candidates: [CANDIDATE],
    truncated: false,
    maxSuggestions: 5,
};

function adapterFor(runner: ScriptedRunner): CleanupSdkAgentAdapter {
    return new CleanupSdkAgentAdapter(runner, {} as CleanupToolDeps);
}

describe("CleanupSdkAgentAdapter", () => {
    it("열어보지도 않은 태스크를 보관하겠다는 출력은 오류를 돌려주고 한 번만 다시 받는다", async () => {
        const runner = new ScriptedRunner([{ suggestions: [suggestion("task-1")] }, { suggestions: [] }]);

        const output = await adapterFor(runner).generate(INPUT);

        expect(runner.prompts).toHaveLength(2);
        expect(runner.prompts[1]).toContain("Deterministic provenance validation rejected part of your output");
        expect(runner.prompts[1]).toContain("unsupported candidate task ID task-1");
        expect(output.suggestions).toEqual([]);
    });

    it("수리한 출력도 근거가 서지 않으면 그 제안을 버린다", async () => {
        const runner = new ScriptedRunner([
            { suggestions: [suggestion("task-1")] },
            { suggestions: [suggestion("task-1")] },
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
