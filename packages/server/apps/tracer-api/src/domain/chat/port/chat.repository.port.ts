import type { ChatMessageEntity, ChatPendingToolEntity, ChatThreadEntity } from "@monitor/tracer-domain";

export const CHAT_THREAD_REPOSITORY = Symbol("ChatThreadRepository");
export const CHAT_MESSAGE_REPOSITORY = Symbol("ChatMessageRepository");
export const CHAT_PENDING_TOOL_REPOSITORY = Symbol("ChatPendingToolRepository");

/** 대화 스레드 애그리게이트의 저장과 조회를 제공하는 포트다. */
export interface ChatThreadRepositoryPort {
    create(thread: ChatThreadEntity): Promise<void>;
    findById(id: string): Promise<ChatThreadEntity | null>;
    listByUser(userId: string, limit?: number): Promise<ChatThreadEntity[]>;
    update(thread: ChatThreadEntity): Promise<void>;
}

/** 대화 메시지의 적재와 스레드별 재생을 제공하는 포트다. */
export interface ChatMessageRepositoryPort {
    append(message: ChatMessageEntity): Promise<void>;
    listByThread(threadId: string): Promise<ChatMessageEntity[]>;
}

/** 쓰기 도구가 확인을 기다리며 세워 두는 대기 도구 행의 저장과 조회를 제공하는 포트다. */
export interface ChatPendingToolRepositoryPort {
    create(pendingTool: ChatPendingToolEntity): Promise<void>;
    findById(id: string): Promise<ChatPendingToolEntity | null>;
    resolve(pendingTool: ChatPendingToolEntity): Promise<void>;
}
