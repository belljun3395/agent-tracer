import { AGENT, JOB_KIND, type TitleSuggestionPayload } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import { buildMcpToolServer } from "~ai-agent-worker/config/llm/claude.tool.schema.js";
import type { IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import { mcpToolNames, withMcpToolPrefix } from "~ai-agent-worker/config/llm/mcp.tool.prefix.js";
import { runStructuredQuery, type StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { withInvokeAgentTelemetry } from "~ai-agent-worker/config/llm/telemetry.js";
import { buildTitleRepairPrompt } from "~ai-agent-worker/domain/title/model/title.prompt.js";
import { TITLE_SUGGESTION_SPEC } from "~ai-agent-worker/domain/title/model/title.spec.js";
import { TITLE_SUGGESTION_TOOL_NAMES } from "~ai-agent-worker/domain/title/model/title.tool.schema.js";
import { validateTitleSuggestions } from "~ai-agent-worker/domain/title/model/title.validation.model.js";
import type {
    GenerateTitleSuggestionsInput,
    GenerateTitleSuggestionsOutput,
    TitleAgentPort,
} from "~ai-agent-worker/domain/title/port/title.agent.port.js";
import { buildTitleToolHandlers, type TitleToolDeps } from "./title.tools.js";

const MCP_SERVER = `monitor-${TITLE_SUGGESTION_SPEC.name}`;

/** Claude Agent SDK 방언으로 title 명세를 렌더링해 실행한다. */
export class TitleSdkAgentAdapter implements TitleAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: TitleToolDeps,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.titleSuggestion,
                agentName: AGENT.titleSuggestion.id,
                backend: AGENT_BACKEND.claudeSdk,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        const handlers = buildTitleToolHandlers(input.userId, this.deps);
        const basePrompt = TITLE_SUGGESTION_SPEC.userPrompt({
            taskId: input.taskId,
            language: input.language,
            context: input.context,
        });

        const first = await this.runOnce(input, handlers, basePrompt);
        const errors = validateTitleSuggestions(first.data.suggestions, input.context.title);
        if (errors.length === 0) return toOutput(first, first.data.suggestions);

        // 제목이 제약을 어기면 오류를 모델에게 돌려주고 한 번만 다시 받는다.
        const repaired = await this.runOnce(
            input,
            handlers,
            buildTitleRepairPrompt(basePrompt, first.data, errors),
        );
        const remaining = validateTitleSuggestions(repaired.data.suggestions, input.context.title);
        return toOutput(repaired, remaining.length === 0 ? repaired.data.suggestions : []);
    }

    private async runOnce(
        input: GenerateTitleSuggestionsInput,
        handlers: ReturnType<typeof buildTitleToolHandlers>,
        prompt: string,
    ): Promise<StructuredRun> {
        const { limits } = TITLE_SUGGESTION_SPEC;
        const model = input.model?.trim() || limits.defaultModel;

        return runStructuredQuery(
            this.runner,
            {
                label: TITLE_SUGGESTION_SPEC.name,
                prompt,
                systemPrompt: withMcpToolPrefix(
                    TITLE_SUGGESTION_SPEC.systemPrompt(input.language),
                    TITLE_SUGGESTION_TOOL_NAMES,
                    MCP_SERVER,
                ),
                allowedTools: mcpToolNames(MCP_SERVER, TITLE_SUGGESTION_TOOL_NAMES),
                jobId: input.jobId,
                model,
                maxTurns: limits.maxTurns,
                maxToolCalls: limits.maxToolCalls,
                maxOutputTokens: limits.maxOutputTokens,
                deadlineMs: limits.deadlineMs,
                // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
                env: {
                    MONITOR_TASK_TITLE: `Agent · ${TITLE_SUGGESTION_SPEC.name}`,
                    MONITOR_TASK_ORIGIN: "server-sdk",
                    ...(input.apiKey !== undefined ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
                },
                outputSchema: zodToClaudeOutputSchema(TITLE_SUGGESTION_SPEC.outputSchema),
                effort: limits.effort,
                maxBudgetUsd: limits.maxBudgetUsd,
                providerOptions: {
                    ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                    mcpServers: {
                        [MCP_SERVER]: buildMcpToolServer(MCP_SERVER, TITLE_SUGGESTION_SPEC.tools, handlers),
                    },
                },
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                ...(input.abortSignal !== undefined ? { parentSignal: input.abortSignal } : {}),
            },
            TITLE_SUGGESTION_SPEC.outputSchema,
        );
    }
}

type StructuredRun = StructuredQueryResult<{ readonly suggestions: TitleSuggestionPayload[] }>;

function toOutput(
    run: StructuredRun,
    suggestions: GenerateTitleSuggestionsOutput["suggestions"],
): GenerateTitleSuggestionsOutput {
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
