import { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatBackend,
  ChatMessageRecord,
  ChatMessageRole,
  ChatThreadRecord,
  ChatToolCall,
} from "~web/entities/chat/model/chat.js";

/** 대화 스레드의 와이어 표현이다. */
export interface ChatThreadWireDto {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly backend: ChatBackend | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 대화 메시지의 와이어 표현이다. */
export interface ChatMessageWireDto {
  readonly id: string;
  readonly threadId: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly toolCalls: readonly ChatToolCall[] | null;
  readonly toolCallId: string | null;
  readonly createdAt: string;
}

export function toChatThreadRecord(thread: ChatThreadWireDto): ChatThreadRecord {
  return {
    id: ChatThreadId(thread.id),
    userId: thread.userId,
    title: thread.title,
    summary: thread.summary,
    backend: thread.backend,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export function toChatMessageRecord(message: ChatMessageWireDto): ChatMessageRecord {
  return {
    id: message.id,
    threadId: ChatThreadId(message.threadId),
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls,
    toolCallId: message.toolCallId,
    createdAt: message.createdAt,
  };
}
