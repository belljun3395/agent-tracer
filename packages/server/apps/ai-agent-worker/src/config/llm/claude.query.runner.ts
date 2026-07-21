import { query } from "@anthropic-ai/claude-agent-sdk";
import type { HookJSONOutput, ModelUsage, SDKResultError } from "@anthropic-ai/claude-agent-sdk";
import { GEN_AI_PROVIDER, type AiJobStepToolCall } from "@monitor/kernel";
import { logWarn } from "~ai-agent-worker/support/log.js";
import { AGENT_ERROR_SUBTYPE } from "~ai-agent-worker/support/llm/agent.error.js";
import type { AgentQueryUsage } from "~ai-agent-worker/support/llm/agent.usage.js";
import { estimateCostUsd } from "~ai-agent-worker/support/llm/pricing.js";
import { buildAgentEnv } from "./claude.env.js";
import { resolveClaudeExecutablePath } from "./claude.executable.js";
import { createAgentDeadline, DeadlineExceededError } from "./deadline.js";
import { withGenAiClientTelemetry } from "./telemetry.js";
import { logAgentQuery } from "./query.log.js";
import { TrajectoryRecorder } from "./trajectory.js";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "./llm.runner.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

interface SdkUsage {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_read_input_tokens: number;
    readonly cache_creation_input_tokens: number;
}

/** Claude Agent SDK로 도구 사용 질의를 실행한다. */
export class ClaudeQueryRunner implements IQueryRunner<ClaudeQueryOptions> {
    // useLocalCliAuth면 API 키를 주입하지 않아 하위 claude CLI가 자기 로그인(구독) 자격증명으로 실행된다.
    constructor(private readonly useLocalCliAuth = false) {}

    requiresLocalApiKey(): boolean {
        return !this.useLocalCliAuth;
    }

    async run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        return withGenAiClientTelemetry(
            {
                model: request.model,
                provider: GEN_AI_PROVIDER.anthropic,
                ...(request.jobId !== undefined ? { jobId: request.jobId } : {}),
            },
            () => this.runQuery(request),
        );
    }

    private async runQuery(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        const startedAt = Date.now();
        let collected = "";
        let resultText = "";
        let structuredOutput: unknown = null;
        let numTurns: number | null = null;
        let costUsd: number | null = null;
        let usage: AgentQueryUsage | null = null;
        let errorSummary: string | null = null;
        let errorSubtype: string | null = null;
        let actualModel: string | null = null;
        const trajectory = new TrajectoryRecorder();
        const toolNameById = new Map<string, string>();

        const deadline = createAgentDeadline(request.deadlineMs);
        if (request.parentSignal) {
            if (request.parentSignal.aborted) deadline.controller.abort();
            else {
                request.parentSignal.addEventListener("abort", () => deadline.controller.abort(), { once: true });
            }
        }

        // graph의 ToolLoopBudget.landing과 동형으로, 이미 태운 비용에 지금까지 가장 비쌌던 호출을
        // 한 번 더 더해도 예산을 감당하는지로 "다음 호출을 못 감당한다"를 예측한다.
        let runningCostUsd = 0;
        let peakCallCostUsd = 0;
        let landing = false;
        // continue:false는 루프를 멈춰 결론 턴을 잃으므로 permissionDecision:deny로 그 도구만 막아 모델이 남은 것으로 구조화 출력을 내게 한다.
        const denyToolsWhenLanding = (): Promise<HookJSONOutput> =>
            Promise.resolve(
                landing
                    ? {
                        hookSpecificOutput: {
                            hookEventName: "PreToolUse",
                            permissionDecision: "deny",
                            permissionDecisionReason:
                                "Cost budget reached. Stop calling tools and produce your final structured output now from what you already have.",
                        },
                    }
                    : { continue: true },
            );

        const options = request.providerOptions;
        const systemPrompt = options?.useClaudeCodePreset === true
            ? {
                type: "preset" as const,
                preset: "claude_code" as const,
                append: request.systemPrompt,
                ...(options.excludeDynamicSections === true ? { excludeDynamicSections: true } : {}),
            }
            : request.systemPrompt;
        const executablePath = resolveClaudeExecutablePath();

        const stream = query({
            prompt: request.prompt,
            options: {
                ...(executablePath !== undefined ? { pathToClaudeCodeExecutable: executablePath } : {}),
                abortController: deadline.controller,
                ...(options?.cwd !== undefined ? { cwd: options.cwd } : {}),
                ...(options?.mcpServers !== undefined ? { mcpServers: options.mcpServers } : {}),
                model: request.model,
                // allowedTools는 자동 승인 목록이고 tools는 사용 가능한 빌트인 도구 집합이다.
                allowedTools: [...request.allowedTools],
                tools: [...(options?.builtInTools ?? [])],
                maxTurns: request.maxTurns,
                systemPrompt,
                ...(request.outputSchema !== undefined
                    ? { outputFormat: { type: "json_schema" as const, schema: request.outputSchema } }
                    : {}),
                env: buildAgentEnv({ ...request.env, IS_SANDBOX: "1" }),
                // 승인 프롬프트 없이 실행하므로 호출자는 읽기 전용 도구만 허용해야 한다.
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                strictMcpConfig: true,
                includePartialMessages: false,
                persistSession: false,
                settingSources: ["user"],
                ...(request.effort !== undefined ? { effort: request.effort } : {}),
                ...(request.maxBudgetUsd !== undefined ? { maxBudgetUsd: request.maxBudgetUsd } : {}),
                ...(options?.fallbackModel !== undefined ? { fallbackModel: options.fallbackModel } : {}),
                ...(options?.agents !== undefined ? { agents: { ...options.agents } } : {}),
                hooks: { PreToolUse: [{ hooks: [denyToolsWhenLanding] }] },
            },
        });

        try {
            for await (const msg of stream) {
                if (msg.type === "assistant") {
                    let text = "";
                    const toolCalls: AiJobStepToolCall[] = [];
                    for (const block of msg.message.content) {
                        if (block.type === "text") text += block.text;
                        if (block.type === "tool_use") {
                            toolCalls.push({ id: block.id, name: block.name, args: toToolArgs(block.input) });
                            toolNameById.set(block.id, block.name);
                        }
                    }
                    collected += text;
                    const callUsage: AgentQueryUsage = {
                        inputTokens: msg.message.usage.input_tokens,
                        outputTokens: msg.message.usage.output_tokens,
                        cacheReadTokens: msg.message.usage.cache_read_input_tokens ?? 0,
                        cacheCreationTokens: msg.message.usage.cache_creation_input_tokens ?? 0,
                    };
                    trajectory.assistant({
                        content: text,
                        toolCalls,
                        ...callUsage,
                        ...(msg.message.stop_reason !== null ? { stopReason: msg.message.stop_reason } : {}),
                    });
                    if (request.maxBudgetUsd !== undefined) {
                        // 폴백이 걸리면 실제 응답 모델이 요청 모델과 달라질 수 있어 이 추정은 근사다.
                        const callCost = estimateCostUsd(request.model, callUsage) ?? 0;
                        runningCostUsd += callCost;
                        peakCallCostUsd = Math.max(peakCallCostUsd, callCost);
                        landing = runningCostUsd + peakCallCostUsd >= request.maxBudgetUsd;
                    }
                    continue;
                }
                // 도구 결과에는 도구 이름이 없어 같은 실행의 호출 ID로 이어 붙인다.
                if (msg.type === "user") {
                    const content = msg.message.content;
                    if (typeof content === "string") continue;
                    for (const block of content) {
                        if (block.type !== "tool_result") continue;
                        trajectory.tool({
                            toolCallId: block.tool_use_id,
                            toolName: toolNameById.get(block.tool_use_id) ?? "",
                            content: toolResultText(block.content),
                        });
                    }
                    continue;
                }
                if (msg.type === "result") {
                    numTurns = msg.num_turns;
                    costUsd = msg.total_cost_usd;
                    usage = toUsage(msg.usage);
                    actualModel = dominantModel(msg.modelUsage);
                    if (msg.subtype === "success") {
                        resultText = msg.result;
                        structuredOutput = msg.structured_output ?? null;
                    } else {
                        errorSubtype = normalizeClaudeResultSubtype(msg.subtype);
                        errorSummary = `${msg.subtype}${msg.errors.length > 0 ? `: ${msg.errors.join("; ")}` : ""}`;
                        if (msg.subtype === "error_max_budget_usd" || msg.subtype === "error_max_turns") {
                            logWarn({
                                msg: "agent.query.exhausted",
                                reason: msg.subtype,
                                label: request.label,
                                jobId: request.jobId ?? null,
                                model: request.model,
                                turns: numTurns,
                                maxTurns: request.maxTurns,
                                costUsd,
                                maxBudgetUsd: request.maxBudgetUsd ?? null,
                            });
                        }
                    }
                    break;
                }
            }
        } catch (err) {
            const reason: unknown = deadline.controller.signal.reason;
            if (deadline.controller.signal.aborted && reason instanceof DeadlineExceededError) {
                errorSubtype = AGENT_ERROR_SUBTYPE.deadlineExceeded;
                errorSummary = reason.message;
            } else if (deadline.controller.signal.aborted) {
                errorSubtype = AGENT_ERROR_SUBTYPE.cancelled;
                errorSummary = "query aborted (parent signal or external cancellation)";
            } else {
                errorSubtype = AGENT_ERROR_SUBTYPE.processError;
                errorSummary = err instanceof Error ? err.message : String(err);
            }
        } finally {
            deadline.dispose();
        }

        const result: AgentQueryResult = {
            rawOutput: resultText || collected,
            structuredOutput,
            durationMs: Date.now() - startedAt,
            numTurns,
            costUsd,
            usage,
            steps: trajectory.snapshot(),
            errorSummary,
            errorSubtype,
            actualModel,
            // Agent SDK는 공급자 요청 식별자를 노출하지 않는다.
            providerRequestId: null,
        };
        logAgentQuery(request.label, GEN_AI_PROVIDER.anthropic, request.model, result, request.jobId);
        return result;
    }
}

function toToolArgs(input: unknown): Record<string, unknown> {
    return typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
}

function toolResultText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    let text = "";
    for (const block of content) {
        if (typeof block === "object" && block !== null && (block as { type?: string }).type === "text") {
            text += (block as { text?: string }).text ?? "";
        }
    }
    return text;
}

function dominantModel(modelUsage: Record<string, ModelUsage> | undefined): string | null {
    let best: string | null = null;
    let bestTokens = -1;
    for (const [model, usage] of Object.entries(modelUsage ?? {})) {
        const tokens = usage.inputTokens + usage.outputTokens;
        if (tokens > bestTokens) {
            best = model;
            bestTokens = tokens;
        }
    }
    return best;
}

function normalizeClaudeResultSubtype(subtype: SDKResultError["subtype"]): string {
    switch (subtype) {
        case "error_max_turns":
            return AGENT_ERROR_SUBTYPE.maxTurnsExceeded;
        case "error_max_budget_usd":
            return AGENT_ERROR_SUBTYPE.budgetExceeded;
        case "error_max_structured_output_retries":
            return AGENT_ERROR_SUBTYPE.outputSchemaInvalid;
        case "error_during_execution":
            return AGENT_ERROR_SUBTYPE.executionError;
        default:
            return AGENT_ERROR_SUBTYPE.executionError;
    }
}

function toUsage(usage: SdkUsage): AgentQueryUsage {
    return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens,
    };
}
