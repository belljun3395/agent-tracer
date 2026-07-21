import type { ChatBackend, ChatMessageEntity, ChatMessageRole, ChatThreadEntity, ChatToolCall } from "@monitor/tracer-domain";

/** 대화 스레드의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface ChatThreadDto {
    readonly id: string;
    readonly userId: string;
    readonly title: string;
    readonly summary: string | null;
    readonly backend: ChatBackend | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/** 대화 메시지의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface ChatMessageDto {
    readonly id: string;
    readonly threadId: string;
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls: readonly ChatToolCall[] | null;
    readonly toolCallId: string | null;
    readonly createdAt: string;
}

export function mapThread(thread: ChatThreadEntity): ChatThreadDto {
    return {
        id: thread.id,
        userId: thread.userId,
        title: thread.title,
        summary: thread.summary,
        backend: thread.backend,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
    };
}

export function mapMessage(message: ChatMessageEntity): ChatMessageDto {
    return {
        id: message.id,
        threadId: message.threadId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        toolCallId: message.toolCallId,
        createdAt: message.createdAt.toISOString(),
    };
}
