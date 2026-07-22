import type {
    ChatBackend,
    ChatExecutionEntity,
    ChatExecutionStatus,
    ChatMessageEntity,
    ChatMessageRole,
    ChatThreadEntity,
    ChatToolCall,
    ChatUserMemoryEntity,
} from "@monitor/tracer-domain";

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

export interface ChatExecutionDto {
    readonly id: string;
    readonly threadId: string;
    readonly userMessageId: string;
    readonly status: ChatExecutionStatus;
    readonly requestedBackend: ChatBackend | null;
    readonly draftText: string;
    readonly draftSeq: number;
    readonly assistantMessageId: string | null;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
}

export function mapExecution(execution: ChatExecutionEntity): ChatExecutionDto {
    return {
        id: execution.id,
        threadId: execution.threadId,
        userMessageId: execution.userMessageId,
        status: execution.status,
        requestedBackend: execution.requestedBackend,
        draftText: execution.draftText,
        draftSeq: execution.draftSeq,
        assistantMessageId: execution.assistantMessageId,
        error: execution.error,
        createdAt: execution.createdAt.toISOString(),
        updatedAt: execution.updatedAt.toISOString(),
        startedAt: execution.startedAt?.toISOString() ?? null,
        completedAt: execution.completedAt?.toISOString() ?? null,
    };
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

/** 사용자 장기기억 한 줄의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface ChatUserMemoryDto {
    readonly key: string;
    readonly content: string;
    readonly updatedAt: string;
}

export function mapMemory(memory: ChatUserMemoryEntity): ChatUserMemoryDto {
    return {
        key: memory.key,
        content: memory.content,
        updatedAt: memory.updatedAt.toISOString(),
    };
}
