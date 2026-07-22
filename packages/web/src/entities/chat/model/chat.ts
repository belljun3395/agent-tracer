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

export type ChatExecutionStatus =
  "queued" | "running" | "completed" | "failed" | "canceled";

export interface ChatExecutionRecord {
  readonly id: string;
  readonly threadId: ChatThreadId;
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

export interface ChatExecutionsListResponse {
  readonly executions: readonly ChatExecutionRecord[];
  readonly confirmations: readonly ChatConfirmationRecord[];
}

export interface ChatConfirmationRecord {
  readonly id: string;
  readonly toolName: string;
  readonly summary: string;
  readonly args: Record<string, unknown>;
}

export interface ChatThreadCreateInput {
  readonly title: string;
}

/** 백엔드가 첫 턴 전까지 스레드에 붙여 두는 기본 제목이다. */
export const DEFAULT_CHAT_THREAD_TITLE = "New conversation";

/** 제목이 아직 비어 있으면 기본 라벨로 되돌려, 화면에 보일 제목을 고른다. */
export function chatThreadDisplayTitle(
  thread: Pick<ChatThreadRecord, "title">,
): string {
  const trimmed = thread.title.trim();
  return trimmed.length === 0 ? DEFAULT_CHAT_THREAD_TITLE : trimmed;
}
