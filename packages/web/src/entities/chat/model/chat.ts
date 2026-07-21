import type { AiAgentBackend } from "@monitor/kernel";
import type { ChatThreadId } from "~web/shared/identity.js";

/** 이 스레드에서 마지막 턴을 실행한 에이전트 실행 백엔드다. */
export type ChatBackend = AiAgentBackend;

export type ChatMessageRole = "user" | "assistant" | "tool";

/** 어시스턴트 메시지가 제안하는 도구 호출 한 건이며, args는 모델이 낸 원본 인자다. */
export interface ChatToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export interface ChatThreadRecord {
  readonly id: ChatThreadId;
  readonly userId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly backend: ChatBackend | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChatMessageRecord {
  readonly id: string;
  readonly threadId: ChatThreadId;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly toolCalls: readonly ChatToolCall[] | null;
  readonly toolCallId: string | null;
  readonly createdAt: string;
}

export interface ChatThreadsListResponse {
  readonly threads: readonly ChatThreadRecord[];
}

export interface ChatMessagesListResponse {
  readonly messages: readonly ChatMessageRecord[];
}

export interface ChatThreadCreateInput {
  readonly title: string;
}
