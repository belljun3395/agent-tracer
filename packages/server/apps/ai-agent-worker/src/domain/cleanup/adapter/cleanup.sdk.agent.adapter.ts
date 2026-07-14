import { AGENT, JOB_KIND, type CleanupSuggestionPayload } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import { buildMcpToolServer } from "~ai-agent-worker/config/llm/claude.tool.schema.js";
import type { IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import { mcpToolNames, withMcpToolPrefix } from "~ai-agent-worker/config/llm/mcp.tool.prefix.js";
import { runStructuredQuery, type StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { withInvokeAgentTelemetry } from "~ai-agent-worker/config/llm/telemetry.js";
import { buildCleanupRepairPrompt } from "~ai-agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { CleanupProvenanceLedger } from "~ai-agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { TASK_CLEANUP_SPEC } from "~ai-agent-worker/domain/cleanup/model/cleanup.spec.js";
import { TASK_CLEANUP_TOOL_NAMES } from "~ai-agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { validateCleanupSuggestions } from "~ai-agent-worker/domain/cleanup/model/cleanup.validation.model.js";
import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { buildCleanupToolHandlers, type CleanupToolDeps } from "./cleanup.tools.js";

const MCP_SERVER = `monitor-${TASK_CLEANUP_SPEC.name}`;

type StructuredRun = StructuredQueryResult<{ readonly suggestions: CleanupSuggestionPayload[] }>;

/** Claude Agent SDK 방언으로 cleanup 명세를 렌더링해 실행한다. */
export class CleanupSdkAgentAdapter implements CleanupAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: CleanupToolDeps,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.taskCleanup,
                agentName: AGENT.taskCleanup.id,
                backend: AGENT_BACKEND.claudeSdk,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        const ledger = new CleanupProvenanceLedger();
        const handlers = buildCleanupToolHandlers(
            input.userId,
            this.deps,
            { candidates: input.candidates, batchTruncated: input.truncated },
            ledger,
        );
        const basePrompt = TASK_CLEANUP_SPEC.userPrompt({
            maxSuggestions: input.maxSuggestions,
            scannedAt: input.scannedAt,
        });

        const first = await this.runOnce(input, handlers, basePrompt);
        const checked = validateCleanupSuggestions(
            first.data.suggestions,
            ledger.snapshot(),
            input.maxSuggestions,
        );
        if (checked.errors.length === 0) return toOutput(first, checked.valid);

        // 근거가 서지 않은 제안만 오류로 돌려주고 한 번만 다시 받는다.
        const repaired = await this.runOnce(
            input,
            handlers,
            buildCleanupRepairPrompt(basePrompt, first.data, checked.errors),
        );
        const rechecked = validateCleanupSuggestions(
            repaired.data.suggestions,
            ledger.snapshot(),
            input.maxSuggestions,
        );
        return toOutput(repaired, rechecked.valid);
    }

    private async runOnce(
        input: GenerateCleanupSuggestionsInput,
        handlers: ReturnType<typeof buildCleanupToolHandlers>,
        prompt: string,
    ): Promise<StructuredRun> {
        const { limits } = TASK_CLEANUP_SPEC;
        const model = input.model?.trim() || limits.defaultModel;

        return runStructuredQuery(
            this.runner,
            {
                label: TASK_CLEANUP_SPEC.name,
                prompt,
                systemPrompt: withMcpToolPrefix(
                    TASK_CLEANUP_SPEC.systemPrompt(input.language),
                    TASK_CLEANUP_TOOL_NAMES,
                    MCP_SERVER,
                ),
                allowedTools: mcpToolNames(MCP_SERVER, TASK_CLEANUP_TOOL_NAMES),
                jobId: input.jobId,
                model,
                maxTurns: limits.maxTurns,
                maxOutputTokens: limits.maxOutputTokens,
                deadlineMs: limits.deadlineMs,
                // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
                env: {
                    MONITOR_TASK_TITLE: `Agent · ${TASK_CLEANUP_SPEC.name}`,
                    MONITOR_TASK_ORIGIN: "server-sdk",
                    ...(input.apiKey !== undefined ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
                },
                outputSchema: zodToClaudeOutputSchema(TASK_CLEANUP_SPEC.outputSchema),
                effort: limits.effort,
                maxBudgetUsd: limits.maxBudgetUsd,
                providerOptions: {
                    ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                    mcpServers: {
                        [MCP_SERVER]: buildMcpToolServer(MCP_SERVER, TASK_CLEANUP_SPEC.tools, handlers),
                    },
                },
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                ...(input.abortSignal !== undefined ? { parentSignal: input.abortSignal } : {}),
            },
            TASK_CLEANUP_SPEC.outputSchema,
        );
    }
}

function toOutput(
    run: StructuredRun,
    suggestions: readonly CleanupSuggestionPayload[],
): GenerateCleanupSuggestionsOutput {
    return {
        suggestions,
        modelUsed: run.modelUsed,
        durationMs: run.durationMs,
        costUsd: run.costUsd,
        numTurns: run.numTurns,
        usage: run.usage,
        steps: run.steps,
    };
}
