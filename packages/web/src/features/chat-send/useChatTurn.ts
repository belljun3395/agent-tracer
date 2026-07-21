import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatBackend } from "~web/entities/chat/model/chat.js";
import type {
  ChatConfirmRequest,
  ChatMemoryUpdate,
  ChatTurnToolCall,
  ChatTurnToolResult,
} from "~web/entities/chat/model/chat-turn.js";
import { streamChatMessage } from "~web/entities/chat/api/stream-chat-message.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

/** 진행 중이거나 방금 끝난 턴의 도구 호출 한 건이며, result가 null이면 아직 응답을 못 받았다. */
export interface LiveToolActivity {
  readonly call: ChatTurnToolCall;
  readonly result: ChatTurnToolResult | null;
}

interface ChatTurnState {
  readonly isStreaming: boolean;
  readonly assistantDraft: string;
  readonly toolActivity: readonly LiveToolActivity[];
  readonly pendingConfirms: readonly ChatConfirmRequest[];
  readonly memoryUpdates: readonly ChatMemoryUpdate[];
  readonly error: string | null;
}

const EMPTY_STATE: ChatTurnState = {
  isStreaming: false,
  assistantDraft: "",
  toolActivity: [],
  pendingConfirms: [],
  memoryUpdates: [],
  error: null,
};

export interface UseChatTurnResult extends ChatTurnState {
  readonly sendMessage: (content: string, agentBackend?: ChatBackend) => void;
  /** 확인 카드가 승인/거절로 해소된 뒤 화면에서 지운다. */
  readonly dismissConfirm: (confirmationId: string) => void;
}

/** 스레드 하나에 사용자 메시지를 보내고, 턴이 끝날 때까지의 실시간 SSE 상태를 들고 있는다. */
export function useChatTurn(threadId: ChatThreadId | null): UseChatTurnResult {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ChatTurnState>(EMPTY_STATE);
  const abortRef = useRef<AbortController | null>(null);

  // 스레드를 바꾸면 이전 스레드의 진행 중 턴을 끊고 상태를 비운다.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(EMPTY_STATE);
  }, [threadId]);

  const sendMessage = useCallback(
    (content: string, agentBackend?: ChatBackend) => {
      const trimmed = content.trim();
      if (!threadId || trimmed.length === 0) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        assistantDraft: "",
        toolActivity: [],
        error: null,
      }));

      void streamChatMessage(
        threadId,
        { content: trimmed, ...(agentBackend ? { agentBackend } : {}) },
        {
          onAssistantDelta: (text) =>
            setState((prev) => ({ ...prev, assistantDraft: prev.assistantDraft + text })),
          onToolCall: (call) =>
            setState((prev) => ({
              ...prev,
              toolActivity: [...prev.toolActivity, { call, result: null }],
            })),
          onToolResult: (result) =>
            setState((prev) => ({
              ...prev,
              toolActivity: prev.toolActivity.map((activity) =>
                activity.call.id === result.toolCallId ? { ...activity, result } : activity,
              ),
            })),
          onConfirmRequest: (request) =>
            setState((prev) => ({
              ...prev,
              pendingConfirms: [...prev.pendingConfirms, request],
            })),
          onMemoryUpdated: (update) =>
            setState((prev) => ({ ...prev, memoryUpdates: [...prev.memoryUpdates, update] })),
          onDone: () => {
            setState((prev) => ({ ...prev, isStreaming: false, assistantDraft: "", toolActivity: [] }));
            void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatMessages(threadId) });
          },
          onError: (message) => setState((prev) => ({ ...prev, isStreaming: false, error: message })),
        },
        controller.signal,
      );
    },
    [threadId, queryClient],
  );

  const dismissConfirm = useCallback((confirmationId: string) => {
    setState((prev) => ({
      ...prev,
      pendingConfirms: prev.pendingConfirms.filter((request) => request.id !== confirmationId),
    }));
  }, []);

  return { ...state, sendMessage, dismissConfirm };
}
