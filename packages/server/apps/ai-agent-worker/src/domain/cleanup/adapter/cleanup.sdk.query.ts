import { buildMcpToolServer } from "~ai-agent-worker/config/llm/claude.tool.schema.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import type { IQueryRunner, OutputSchema, ToolHandlers } from "~ai-agent-worker/config/llm/llm.runner.js";
import { mcpToolNames, withMcpToolPrefix } from "~ai-agent-worker/config/llm/mcp.tool.prefix.js";
import { runStructuredQuery, type StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { TASK_CLEANUP_SPEC } from "~ai-agent-worker/domain/cleanup/model/cleanup.spec.js";
import type { CleanupToolSpec } from "~ai-agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import type { GenerateCleanupSuggestionsInput } from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";

export const CLEANUP_MCP_SERVER = `monitor-${TASK_CLEANUP_SPEC.name}`;

/** task-cleanup의 각 호출이 공유하는 실행 입력이다. */
export interface CleanupQueryContext {
    readonly runner: IQueryRunner<ClaudeQueryOptions>;
    readonly input: GenerateCleanupSuggestionsInput;
}

export interface CleanupQuerySpec<T> {
    readonly label: string;
    readonly prompt: string;
    readonly systemPrompt: string;
    readonly toolNames: readonly string[];
    readonly toolSpecs: readonly CleanupToolSpec[];
    readonly handlers: ToolHandlers;
    readonly outputSchema: OutputSchema<T>;
    /** 호출부가 자기 zod 스키마로 미리 만들어 건네는, Claude 구조화 출력용 JSON 스키마다. */
    readonly claudeOutputSchema: Record<string, unknown>;
    readonly lease: AgentBudgetLease;
}

/** task-cleanup 호출 하나가 공통으로 거치는 모델·예산·MCP 배선을 한 곳에 모은다. */
export function runCleanupQuery<T>(
    ctx: CleanupQueryContext,
    spec: CleanupQuerySpec<T>,
): Promise<StructuredQueryResult<T>> {
    const { limits } = TASK_CLEANUP_SPEC;
    const model = ctx.input.model?.trim() || limits.defaultModel;
    const allowedTools = mcpToolNames(CLEANUP_MCP_SERVER, spec.toolNames);

    return runStructuredQuery(
        ctx.runner,
        {
            label: spec.label,
            prompt: spec.prompt,
            systemPrompt: withMcpToolPrefix(spec.systemPrompt, spec.toolNames, CLEANUP_MCP_SERVER),
            allowedTools,
            jobId: ctx.input.jobId,
            model,
            maxTurns: spec.lease.maxTurns,
            maxOutputTokens: limits.maxOutputTokens,
            deadlineMs: limits.deadlineMs,
            // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
            env: {
                MONITOR_TASK_TITLE: `Agent · ${spec.label}`,
                MONITOR_TASK_ORIGIN: "server-sdk",
                ...(ctx.input.apiKey !== undefined ? { ANTHROPIC_API_KEY: ctx.input.apiKey } : {}),
            },
            outputSchema: spec.claudeOutputSchema,
            effort: limits.effort,
            ...(spec.lease.maxBudgetUsd !== undefined ? { maxBudgetUsd: spec.lease.maxBudgetUsd } : {}),
            providerOptions: {
                ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                mcpServers: {
                    [CLEANUP_MCP_SERVER]: buildMcpToolServer(CLEANUP_MCP_SERVER, spec.toolSpecs, spec.handlers),
                },
            },
            ...(ctx.input.idempotencyKey !== undefined ? { idempotencyKey: ctx.input.idempotencyKey } : {}),
            ...(ctx.input.abortSignal !== undefined ? { parentSignal: ctx.input.abortSignal } : {}),
        },
        spec.outputSchema,
    );
}
