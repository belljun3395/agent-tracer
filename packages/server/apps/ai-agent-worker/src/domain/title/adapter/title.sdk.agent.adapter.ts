import { AGENT, JOB_KIND, type TitleSuggestionPayload } from "@monitor/kernel";
import { mergeAgentCallAccounting } from "~ai-agent-worker/support/llm/agent.accounting.js";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { ExecutionBudget, type AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import { isBudgetExhaustedFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import { mergeAgentTrajectory } from "~ai-agent-worker/support/llm/agent.trajectory.js";
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

// 첫 실행이 예산을 거의 다 써도 수리가 도구를 쥔 채 출력을 낼 최소 여지는 남긴다.
const REPAIR_RESERVED_TURNS = 1;
const REPAIR_RESERVED_BUDGET_SHARE = 0.2;

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
        const { limits } = TITLE_SUGGESTION_SPEC;
        const budget = new ExecutionBudget({ maxBudgetUsd: limits.maxBudgetUsd, maxTurns: limits.maxTurns });

        // 수리 몫을 먼저 떼어 두어 첫 실행이 예산을 다 쓰더라도 수리가 도구를 쥐고 출력을 낼 수 있다.
        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);

        const firstLease = budget.lease(1);
        const first = await this.runOnce(input, handlers, basePrompt, firstLease);
        budget.settle(firstLease, { costUsd: first.costUsd, numTurns: first.numTurns });
        const runs: RunSegment[] = [{ run: first, nodeName: "investigate" }];

        const errors = validateTitleSuggestions(first.data.suggestions, input.context.title);
        if (errors.length === 0) return toOutput(runs, first.data.suggestions);

        // 예약된 몫마저 바닥나 수리를 시도할 수 없으면 오류가 아닌 빈 결과로 착지한다.
        if (repairLease.maxTurns <= 0) return toOutput(runs, []);

        // 제목이 제약을 어기면 오류를 모델에게 돌려주고 예약해 둔 몫으로 한 번만 다시 받는다.
        let repaired: StructuredRun;
        try {
            repaired = await this.runOnce(
                input,
                handlers,
                buildTitleRepairPrompt(basePrompt, first.data, errors),
                repairLease,
            );
        } catch (error) {
            // 예약해 둔 몫으로도 모델이 예산을 다 써버렸으면 잡을 실패시키지 않고 빈 결과로 착지한다.
            if (isBudgetExhaustedFailure(error)) return toOutput(runs, []);
            throw error;
        }
        budget.settle(repairLease, { costUsd: repaired.costUsd, numTurns: repaired.numTurns });
        runs.push({ run: repaired, nodeName: "repair" });

        const remaining = validateTitleSuggestions(repaired.data.suggestions, input.context.title);
        return toOutput(runs, remaining.length === 0 ? repaired.data.suggestions : []);
    }

    private async runOnce(
        input: GenerateTitleSuggestionsInput,
        handlers: ReturnType<typeof buildTitleToolHandlers>,
        prompt: string,
        lease: AgentBudgetLease,
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
                maxTurns: lease.maxTurns,
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
                ...(lease.maxBudgetUsd !== undefined ? { maxBudgetUsd: lease.maxBudgetUsd } : {}),
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

interface RunSegment {
    readonly run: StructuredRun;
    readonly nodeName: string;
}

function toOutput(
    runs: readonly RunSegment[],
    suggestions: GenerateTitleSuggestionsOutput["suggestions"],
): GenerateTitleSuggestionsOutput {
    const last = runs[runs.length - 1]!.run;
    const accounting = mergeAgentCallAccounting(runs.map(({ run }) => run));
    return {
        suggestions,
        modelUsed: last.modelUsed,
        durationMs: accounting.durationMs,
        costUsd: accounting.costUsd,
        numTurns: accounting.numTurns,
        usage: accounting.usage,
        steps: mergeAgentTrajectory(runs.map(({ run, nodeName }) => ({ nodeName, steps: run.steps }))),
    };
}
