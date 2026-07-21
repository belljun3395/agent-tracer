import { AGENT, JOB_KIND, type CleanupSuggestionPayload } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { ClaudeSubagentCatalog } from "~ai-agent-worker/config/llm/claude.subagent.catalog.js";
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
import { TASK_CLEANUP_TOOL, TASK_CLEANUP_TOOL_NAMES } from "~ai-agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { validateCleanupSuggestions } from "~ai-agent-worker/domain/cleanup/model/cleanup.validation.model.js";
import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { buildCleanupToolHandlers, type CleanupToolDeps } from "./cleanup.tools.js";

const MCP_SERVER = `monitor-${TASK_CLEANUP_SPEC.name}`;
const AGENT_TOOL = "Agent";
export const CLEANUP_REVIEWER_ROLE = "cleanup-candidate-reviewer";
export const CLEANUP_REVIEWER_MAX_TURNS = 4;
export const CLEANUP_REVIEWER_TOOLS = [TASK_CLEANUP_TOOL.getTaskEvents] as const;

// SDK는 선별과 조율을 한 리드에 합치므로 리드는 후보를 훑는 list_candidate_tasks만 쥐고
// 이벤트 열람(get_task_events)은 검토 전문가에게만 남겨 조율자가 근거를 직접 캐지 못하게 한다.
export const CLEANUP_COORDINATOR_TOOLS = [TASK_CLEANUP_TOOL.listCandidateTasks] as const;

const CLEANUP_SUBAGENTS = new ClaudeSubagentCatalog<
    typeof CLEANUP_REVIEWER_ROLE,
    (typeof TASK_CLEANUP_TOOL_NAMES)[number]
>(
    {
        [CLEANUP_REVIEWER_ROLE]: {
            description: "Inspect one cleanup candidate's events and decide whether it is an empty or disposable shell versus substantive work.",
            prompt: 'Inspect exactly the taskId assigned by the parent. Read enough events, including the ending when useful, to determine whether substantive user work, edits, commands, or a conclusion occurred. Return exactly one JSON report with this shape: {"taskId":"...","archivable":false,"reason":"...","citedEventIds":["..."]}. Use only event IDs returned for that task. Do not inspect other candidates and do not produce the final cleanup schema.',
            tools: CLEANUP_REVIEWER_TOOLS,
            maxTurns: CLEANUP_REVIEWER_MAX_TURNS,
        },
    },
    MCP_SERVER,
);

const DELEGATION_DIRECTIVE = `

Investigation organization:
  - You are the lead janitor. First call list_candidate_tasks yourself.
  - For every hasEvents=true candidate you might archive, delegate its review to cleanup-candidate-reviewer with the exact taskId and candidate signals. Launch independent reviews together when possible.
  - Treat reviewer reports as evidence summaries. The parent thread owns the final archive decisions and structured output.
  - Never propose a hasEvents=true task that cleanup-candidate-reviewer did not actually open.`;

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
                    TASK_CLEANUP_SPEC.systemPrompt(input.language) + DELEGATION_DIRECTIVE,
                    TASK_CLEANUP_TOOL_NAMES,
                    MCP_SERVER,
                ),
                allowedTools: [...mcpToolNames(MCP_SERVER, CLEANUP_COORDINATOR_TOOLS), AGENT_TOOL],
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
                    builtInTools: [AGENT_TOOL],
                    agents: CLEANUP_SUBAGENTS.definitions(model),
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
