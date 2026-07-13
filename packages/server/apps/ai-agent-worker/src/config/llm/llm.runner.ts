import type { AiJobStepPayload } from "@monitor/kernel";
import type { AgentQueryUsage } from "~ai-agent-worker/support/llm/agent.usage.js";

/** 구조화 출력 검증기의 구조적 표면이며 zod 스키마가 그대로 맞는다. */
export type SafeParsed<T> =
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly message: string } };

export interface OutputSchema<T> {
    safeParse(value: unknown): SafeParsed<T>;
}

export type AgentEffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

/** 언어 모델이 실행 중 부를 수 있는 도구 하나다. */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export type ToolHandlers = Readonly<Record<string, ToolHandler>>;

export interface AgentQueryRequest<ProviderOptions = undefined> {
    readonly label: string;
    readonly prompt: string;
    readonly systemPrompt: string;
    readonly allowedTools: readonly string[];
    readonly jobId?: string;
    readonly model: string;
    readonly maxTurns: number;
    readonly maxOutputTokens?: number;
    readonly deadlineMs: number;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly outputSchema?: Record<string, unknown>;
    readonly idempotencyKey?: string;
    readonly parentSignal?: AbortSignal;
    readonly providerOptions?: ProviderOptions;
    readonly effort?: AgentEffortLevel;
    readonly maxBudgetUsd?: number;
}

export interface AgentQueryResult {
    readonly rawOutput: string;
    readonly structuredOutput: unknown;
    readonly durationMs: number;
    readonly numTurns: number | null;
    readonly costUsd: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 성공이든 실패든 그 시점까지의 실행 궤적이다. */
    readonly steps: readonly AiJobStepPayload[];
    readonly errorSummary: string | null;
    readonly errorSubtype: string | null;
    readonly retryAfterMs?: number | null;
    /** 공급자가 실제로 응답을 만든 모델이며 fallback으로 요청 모델과 달라질 수 있다. */
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
}

/** 프롬프트를 넣으면 구조화 출력을 내는 공급자 실행기다. */
export interface IQueryRunner<ProviderOptions = undefined> {
    requiresLocalApiKey(): boolean;
    run(request: AgentQueryRequest<ProviderOptions>): Promise<AgentQueryResult>;
}

/** 러너와 무관한 구조화 실행 결과다. */
export interface StructuredAgentResult<T> {
    readonly data: T;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly AiJobStepPayload[];
    readonly providerRequestId: string | null;
}

/** 도메인 어휘를 모른 채 구조화 출력을 내는 사이드카 실행기다. */
export interface AgentRunnerPort {
    requiresLocalApiKey(): boolean;
    runStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
    ): Promise<StructuredAgentResult<T>>;
}
