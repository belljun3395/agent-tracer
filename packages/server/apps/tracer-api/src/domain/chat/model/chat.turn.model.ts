import type { AiAgentBackend } from "@monitor/kernel";
import type { AgentQueryUsage } from "@monitor/llm-runtime";
import type { ChatMessageRole, ChatToolCall } from "@monitor/tracer-domain";

/** 대화 턴에 재생되는 이전 메시지 한 건이며, 저장 엔티티가 아닌 재생용 평문이다. */
export interface ChatTurnMessage {
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls?: readonly ChatToolCall[];
    readonly toolCallId?: string;
}

/** 모델이 이번 턴에 제안한 도구 호출이며, 어시스턴트 메시지에 그대로 실려 저장된다. */
export interface ChatTurnToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

/** 도구가 이번 턴에 낸 결과이며, toolCallId로 어느 호출의 결과인지 잇는다. */
export interface ChatTurnToolResult {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly content: string;
}

/** 쓰기 도구가 실행 대신 세운 승인 요청 한 건이며, id는 이 요청을 해소할 확인 식별자다. */
export interface ChatConfirmRequest {
    readonly id: string;
    readonly toolName: string;
    /** 사용자가 무엇을 승인하는지 한눈에 읽는 인자 요약이다. */
    readonly summary: string;
    readonly args: Record<string, unknown>;
}

/** 턴이 끝나기 전에 부분 산출을 흘려보내는 싱크이며, mutation 도구는 실행 대신 onConfirmRequest로 승인 요청을 흘린다. */
export interface ChatTurnSink {
    onAssistantDelta(text: string): void;
    onToolCall(call: ChatTurnToolCall): void;
    onToolResult(result: ChatTurnToolResult): void;
    onConfirmRequest?(request: ChatConfirmRequest): void;
}

/** 한 대화 턴의 실행 입력이다. */
export interface ChatTurnInput {
    readonly threadId: string;
    readonly userId: string;
    readonly language: string;
    /** 이 턴 직전까지 스레드에 쌓인 메시지이며, 마지막이 방금 받은 사용자 메시지다. */
    readonly messages: readonly ChatTurnMessage[];
    readonly summary?: string | null;
    readonly model?: string;
    readonly apiKey?: string;
    readonly deadlineMs: number;
    readonly abortSignal?: AbortSignal;
}

/** 한 대화 턴의 실행 결과다. */
export interface ChatTurnResult {
    readonly text: string;
    readonly backend: AiAgentBackend;
    readonly toolCalls: readonly ChatTurnToolCall[];
    readonly modelUsed: string;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly errorSummary: string | null;
}
