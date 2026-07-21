import { CHAT_THREADS_PATH } from "@monitor/kernel";
import type { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatMessagesListResponse,
  ChatThreadCreateInput,
  ChatThreadRecord,
  ChatThreadsListResponse,
} from "~web/entities/chat/model/chat.js";
import { getJson, postJson } from "~web/shared/api/client/json-methods.js";
import {
  toChatMessageRecord,
  toChatThreadRecord,
  type ChatMessageWireDto,
  type ChatThreadWireDto,
} from "~web/entities/chat/api/chat.mapper.js";

export async function fetchChatThreads(): Promise<ChatThreadsListResponse> {
  const res = await getJson<{ readonly items: readonly ChatThreadWireDto[] }>(CHAT_THREADS_PATH);
  return { threads: res.items.map(toChatThreadRecord) };
}

export interface ChatThreadDetailResponse {
  readonly thread: ChatThreadRecord;
}

export async function fetchChatThread(threadId: ChatThreadId): Promise<ChatThreadDetailResponse> {
  const res = await getJson<{ readonly thread: ChatThreadWireDto }>(
    `${CHAT_THREADS_PATH}/${threadId}`,
  );
  return { thread: toChatThreadRecord(res.thread) };
}

export async function fetchChatMessages(threadId: ChatThreadId): Promise<ChatMessagesListResponse> {
  const res = await getJson<{ readonly items: readonly ChatMessageWireDto[] }>(
    `${CHAT_THREADS_PATH}/${threadId}/messages`,
  );
  return { messages: res.items.map(toChatMessageRecord) };
}

export interface CreateChatThreadResponse {
  readonly thread: ChatThreadRecord;
}

export async function createChatThread(
  body: ChatThreadCreateInput,
): Promise<CreateChatThreadResponse> {
  const res = await postJson<{ readonly thread: ChatThreadWireDto }>(CHAT_THREADS_PATH, body);
  return { thread: toChatThreadRecord(res.thread) };
}

export type ChatConfirmDecision = "approve" | "reject";

export interface ConfirmChatToolInput {
  readonly threadId: ChatThreadId;
  readonly confirmationId: string;
  readonly decision: ChatConfirmDecision;
}

export interface ConfirmChatToolResponse {
  readonly confirmationId: string;
  readonly toolName: string;
  readonly status: string;
  readonly result: string;
}

export function confirmChatTool(input: ConfirmChatToolInput): Promise<ConfirmChatToolResponse> {
  return postJson<ConfirmChatToolResponse>(
    `${CHAT_THREADS_PATH}/${input.threadId}/confirmations/${input.confirmationId}`,
    { decision: input.decision },
  );
}
