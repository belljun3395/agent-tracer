import type { AiAgentBackend } from "@monitor/kernel";
import type { AgentQueryUsage } from "@monitor/llm-runtime";
import type { ChatMessageEntity, ChatMessageRole, ChatToolCall } from "@monitor/tracer-domain";

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

/** 사용자에 대해 모델이 오래 기억하는 사실 한 건이며, key가 재작성 대상을 찾는 안정된 슬러그다. */
export interface ChatUserFact {
    readonly key: string;
    readonly content: string;
}

/** remember_fact가 즉시 적재한 기억을 사용자에게 투명하게 알리는 갱신 통지다. */
export interface ChatMemoryUpdate {
    readonly key: string;
    readonly content: string;
}

/** 턴이 끝나기 전에 부분 산출을 흘려보내는 싱크이며, mutation 도구는 실행 대신 onConfirmRequest로 승인 요청을 흘린다. */
export interface ChatTurnSink {
    /** Promise를 돌려주면 호출자가 그 완료를 기다려 브라우저 쪽 역압력을 상류로 전한다. */
    onAssistantDelta(text: string): void | Promise<void>;
    onToolCall(call: ChatTurnToolCall): void | Promise<void>;
    onToolResult(result: ChatTurnToolResult): void | Promise<void>;
    onConfirmRequest?(request: ChatConfirmRequest): void | Promise<void>;
    /** remember_fact가 확인 게이트 없이 즉시 적재한 기억을 투명성 통지로 흘려보낸다. */
    onMemoryUpdated?(update: ChatMemoryUpdate): void | Promise<void>;
}

/** 한 대화 턴의 실행 입력이다. */
export interface ChatTurnInput {
    readonly idempotencyKey: string;
    readonly threadId: string;
    readonly userId: string;
    readonly language: string;
    /** 이 턴 직전까지 스레드에 쌓인 메시지이며, 마지막이 방금 받은 사용자 메시지다. */
    readonly messages: readonly ChatTurnMessage[];
    /** 모든 스레드에 걸쳐 이 사용자에 대해 기억해 둔 사실이며, 프롬프트 맨 앞에 주입된다. */
    readonly facts?: readonly ChatUserFact[];
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

/** 저장 엔티티를 재생용 평문으로 벗겨 내는 유일한 변환이며, 재생을 쓰는 모든 유스케이스가 공유한다. */
export function toChatTurnMessage(message: ChatMessageEntity): ChatTurnMessage {
    return {
        role: message.role,
        content: message.content,
        ...(message.toolCalls !== null ? { toolCalls: message.toolCalls } : {}),
        ...(message.toolCallId !== null ? { toolCallId: message.toolCallId } : {}),
    };
}
