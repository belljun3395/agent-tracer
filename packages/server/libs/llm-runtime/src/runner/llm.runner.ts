import type { AiJobStepPayload } from "@monitor/kernel";
import type { AgentQueryUsage } from "../model/agent.usage.js";

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

/** 스트리밍 실행에서 모델이 제안한 도구 호출 한 건이며, args는 모델이 낸 원본 인자다. */
export interface AgentStreamToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

/** 스트리밍 실행에서 도구가 낸 결과이며, toolCallId로 어느 호출의 결과인지 잇는다. */
export interface AgentStreamToolResult {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly content: string;
}

/** 실행이 끝나기 전에 부분 산출을 흘려보내는 싱크이며, 호출자가 넘길 때만 러너가 부분 메시지를 켠다. */
export interface AgentStreamSink {
    onAssistantDelta(text: string): void;
    onToolCall(call: AgentStreamToolCall): void;
    onToolResult(result: AgentStreamToolResult): void;
}

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
    /** 있으면 러너가 부분 메시지를 켜고 실행 중 부분 산출을 이 싱크로 흘려보내며, 없으면 단발 실행과 바이트 단위로 같다. */
    readonly stream?: AgentStreamSink;
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

/** 도메인 어휘를 모른 채 구조화 출력을 내는 실행 백엔드 실행기다. */
export interface AgentRunnerPort {
    requiresLocalApiKey(): boolean;
    runStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
    ): Promise<StructuredAgentResult<T>>;
}
