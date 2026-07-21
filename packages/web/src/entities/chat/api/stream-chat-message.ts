import { CHAT_THREADS_PATH } from "@monitor/kernel";
import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatBackend } from "~web/entities/chat/model/chat.js";
import type {
  ChatConfirmRequest,
  ChatMemoryUpdate,
  ChatTurnSummary,
  ChatTurnToolCall,
  ChatTurnToolResult,
} from "~web/entities/chat/model/chat-turn.js";
import { getMonitorApiBaseUrl } from "~web/shared/api/monitor-endpoints.js";
import { getUserId } from "~web/shared/api/user-identity.js";
import { createResponseError } from "~web/shared/api/client/response.js";

export interface ChatStreamBody {
  readonly content: string;
  readonly agentBackend?: ChatBackend;
}

export interface ChatStreamHandlers {
  readonly onAssistantDelta?: (text: string) => void;
  readonly onToolCall?: (call: ChatTurnToolCall) => void;
  readonly onToolResult?: (result: ChatTurnToolResult) => void;
  readonly onConfirmRequest?: (request: ChatConfirmRequest) => void;
  readonly onMemoryUpdated?: (update: ChatMemoryUpdate) => void;
  readonly onDone?: (summary: ChatTurnSummary) => void;
  readonly onError?: (message: string) => void;
}

/** 스레드에 사용자 메시지를 보내고, EventSource가 못 하는 POST를 fetch + ReadableStream 리더로 직접 파싱해 한 턴을 소비한다. */
export async function streamChatMessage(
  threadId: ChatThreadId,
  body: ChatStreamBody,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const pathname = `${CHAT_THREADS_PATH}/${threadId}/messages`;
  const headers = new Headers({ "content-type": "application/json" });
  const userId = getUserId();
  if (userId) headers.set("x-monitor-user", userId);

  let response: Response;
  try {
    response = await fetch(`${getMonitorApiBaseUrl()}${pathname}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) return;
    handlers.onError?.(toErrorMessage(error));
    return;
  }

  if (!response.ok || response.body === null) {
    const error = await createResponseError(response, pathname, "POST");
    handlers.onError?.(error.message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeFrames(buffer, handlers);
    }
  } catch (error) {
    if (!signal?.aborted) handlers.onError?.(toErrorMessage(error));
  } finally {
    reader.releaseLock();
  }
}

/** 빈 줄로 끊긴 완결 프레임만 소비하고, 아직 끊기지 않은 나머지는 다음 청크로 넘긴다. */
function consumeFrames(buffer: string, handlers: ChatStreamHandlers): string {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  for (const frame of frames) {
    if (frame.trim().length > 0) dispatchFrame(frame, handlers);
  }
  return rest;
}

function dispatchFrame(frame: string, handlers: ChatStreamHandlers): void {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) data += line.slice("data:".length).trim();
  }
  if (data.length === 0) return;

  const payload = JSON.parse(data) as Record<string, unknown>;
  switch (event) {
    case "assistant_delta":
      handlers.onAssistantDelta?.((payload as { text: string }).text);
      return;
    case "tool_call":
      handlers.onToolCall?.(payload as unknown as ChatTurnToolCall);
      return;
    case "tool_result":
      handlers.onToolResult?.(payload as unknown as ChatTurnToolResult);
      return;
    case "tool_confirm_request":
      handlers.onConfirmRequest?.(payload as unknown as ChatConfirmRequest);
      return;
    case "memory_updated":
      handlers.onMemoryUpdated?.(payload as unknown as ChatMemoryUpdate);
      return;
    case "done":
      handlers.onDone?.((payload as { message: ChatTurnSummary }).message);
      return;
    case "error":
      handlers.onError?.((payload as { message: string }).message);
      return;
    default:
      return;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
