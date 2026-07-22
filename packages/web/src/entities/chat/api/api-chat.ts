import { CHAT_THREADS_PATH } from "@monitor/kernel";
import type { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatMessagesListResponse,
  ChatMessageRecord,
  ChatExecutionRecord,
  ChatExecutionsListResponse,
  ChatBackend,
  ChatThreadCreateInput,
  ChatThreadRecord,
  ChatThreadsListResponse,
} from "~web/entities/chat/model/chat.js";
import {
  deleteRequest,
  getJson,
  patchJson,
  postJson,
} from "~web/shared/api/client/json-methods.js";
import {
  toChatMessageRecord,
  toChatThreadRecord,
  type ChatMessageWireDto,
  type ChatThreadWireDto,
} from "~web/entities/chat/api/chat.mapper.js";

export async function fetchChatThreads(): Promise<ChatThreadsListResponse> {
  const res = await getJson<{ readonly items: readonly ChatThreadWireDto[] }>(
    CHAT_THREADS_PATH,
  );
  return { threads: res.items.map(toChatThreadRecord) };
}

export interface ChatThreadDetailResponse {
  readonly thread: ChatThreadRecord;
}

export async function fetchChatThread(
  threadId: ChatThreadId,
): Promise<ChatThreadDetailResponse> {
  const res = await getJson<{ readonly thread: ChatThreadWireDto }>(
    `${CHAT_THREADS_PATH}/${threadId}`,
  );
  return { thread: toChatThreadRecord(res.thread) };
}

export async function fetchChatMessages(
  threadId: ChatThreadId,
): Promise<ChatMessagesListResponse> {
  const res = await getJson<{ readonly items: readonly ChatMessageWireDto[] }>(
    `${CHAT_THREADS_PATH}/${threadId}/messages`,
  );
  return { messages: res.items.map(toChatMessageRecord) };
}

export interface StartChatTurnInput {
  readonly clientRequestId: string;
  readonly content: string;
  readonly agentBackend?: ChatBackend;
}

export interface StartChatTurnResponse {
  readonly message: ChatMessageRecord;
  readonly execution: ChatExecutionRecord;
}

export async function startChatTurn(
  threadId: ChatThreadId,
  input: StartChatTurnInput,
): Promise<StartChatTurnResponse> {
  const res = await postJson<{
    readonly message: ChatMessageWireDto;
    readonly execution: ChatExecutionRecord;
  }>(`${CHAT_THREADS_PATH}/${threadId}/messages`, input);
  return {
    message: toChatMessageRecord(res.message),
    execution: res.execution,
  };
}

export async function fetchChatExecutions(
  threadId: ChatThreadId,
): Promise<ChatExecutionsListResponse> {
  const res = await getJson<{
    readonly items: readonly ChatExecutionRecord[];
    readonly confirmations: readonly {
      readonly id: string;
      readonly toolName: string;
      readonly args: Record<string, unknown>;
    }[];
  }>(`${CHAT_THREADS_PATH}/${threadId}/executions`);
  return {
    executions: res.items,
    confirmations: res.confirmations.map((request) => ({
      ...request,
      summary: summarizeToolRequest(request.toolName, request.args),
    })),
  };
}

export function summarizeToolRequest(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const parts = Object.entries(args).map(
    ([key, value]) => `${key}=${String(value)}`,
  );
  return parts.length === 0 ? toolName : `${toolName}(${parts.join(", ")})`;
}

export async function cancelChatExecution(
  threadId: ChatThreadId,
  executionId: string,
): Promise<{ readonly execution: ChatExecutionRecord }> {
  return postJson(
    `${CHAT_THREADS_PATH}/${threadId}/executions/${executionId}/cancel`,
  );
}

export interface CreateChatThreadResponse {
  readonly thread: ChatThreadRecord;
}

export async function createChatThread(
  body: ChatThreadCreateInput,
): Promise<CreateChatThreadResponse> {
  const res = await postJson<{ readonly thread: ChatThreadWireDto }>(
    CHAT_THREADS_PATH,
    body,
  );
  return { thread: toChatThreadRecord(res.thread) };
}

export interface DeleteChatThreadResponse {
  readonly deleted: true;
}

export function deleteChatThread(
  threadId: ChatThreadId,
): Promise<DeleteChatThreadResponse> {
  return deleteRequest<DeleteChatThreadResponse>(
    `${CHAT_THREADS_PATH}/${threadId}`,
  );
}

export async function renameChatThread(
  threadId: ChatThreadId,
  title: string,
): Promise<ChatThreadDetailResponse> {
  const response = await patchJson<{ readonly thread: ChatThreadWireDto }>(
    `${CHAT_THREADS_PATH}/${threadId}`,
    { title },
  );
  return { thread: toChatThreadRecord(response.thread) };
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

export function confirmChatTool(
  input: ConfirmChatToolInput,
): Promise<ConfirmChatToolResponse> {
  return postJson<ConfirmChatToolResponse>(
    `${CHAT_THREADS_PATH}/${input.threadId}/confirmations/${input.confirmationId}`,
    { decision: input.decision },
  );
}
