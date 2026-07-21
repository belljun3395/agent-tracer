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
  /** 진행 중인 턴을 사용자가 취소하며, 백엔드는 취소된 부분 응답을 버린다. */
  readonly stop: () => void;
  /** 확인 카드가 승인/거절로 해소된 뒤 화면에서 지운다. */
  readonly dismissConfirm: (confirmationId: string) => void;
}

/** 스레드 하나에 사용자 메시지를 보내고, 턴이 끝날 때까지의 실시간 SSE 상태를 들고 있는다. */
export function useChatTurn(threadId: ChatThreadId | null): UseChatTurnResult {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ChatTurnState>(EMPTY_STATE);
  const abortRef = useRef<AbortController | null>(null);
  // 렌더나 StrictMode 이펙트 재실행이 아니라 사용자가 스레드를 진짜로 바꿨을 때만 턴을 끊도록, 지금 턴이 속한 스레드를 기준값으로 들고 있는다.
  const activeThreadRef = useRef<ChatThreadId | null>(threadId);
  // done 뒤 히스토리 재조회를 기다리는 동안 새 전송이 끼어들어도 오래된 턴이 새 드래프트를 지우지 못하게, 전송마다 증가시키는 일련번호다.
  const turnSeqRef = useRef(0);

  // 같은 스레드의 재렌더나 StrictMode 마운트 이펙트 재실행은 무시하고, 사용자가 스레드를 진짜로 바꿨을 때만 이전 턴을 끊고 상태를 비운다.
  useEffect(() => {
    if (activeThreadRef.current === threadId) return;
    activeThreadRef.current = threadId;
    abortRef.current?.abort();
    abortRef.current = null;
    turnSeqRef.current += 1;
    setState(EMPTY_STATE);
  }, [threadId]);

  const sendMessage = useCallback(
    (content: string, agentBackend?: ChatBackend) => {
      const trimmed = content.trim();
      if (!threadId || trimmed.length === 0) return;

      // 진행 중인 턴이 있으면 끊고 곧바로 새 턴을 시작하며(stop-and-send), 백엔드가 끊긴 부분 응답을 버리므로 빈 메시지는 저장되지 않는다.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      activeThreadRef.current = threadId;
      const turnSeq = (turnSeqRef.current += 1);

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
            // 빈 말풍선이 번쩍이지 않도록, 스트리밍한 텍스트를 그대로 둔 채 히스토리를 다시 불러오고 저장된 메시지가 자리를 잡은 뒤에야 드래프트를 지운다.
            setState((prev) => ({ ...prev, isStreaming: false }));
            void queryClient
              .invalidateQueries({ queryKey: monitorQueryKeys.chatMessages(threadId) })
              .then(() => {
                if (turnSeqRef.current !== turnSeq) return;
                setState((prev) => ({ ...prev, assistantDraft: "", toolActivity: [] }));
              });
          },
          onError: (message) => setState((prev) => ({ ...prev, isStreaming: false, error: message })),
        },
        controller.signal,
      );
    },
    [threadId, queryClient],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    turnSeqRef.current += 1;
    setState((prev) => ({ ...prev, isStreaming: false, assistantDraft: "", toolActivity: [] }));
  }, []);

  const dismissConfirm = useCallback((confirmationId: string) => {
    setState((prev) => ({
      ...prev,
      pendingConfirms: prev.pendingConfirms.filter((request) => request.id !== confirmationId),
    }));
  }, []);

  return { ...state, sendMessage, stop, dismissConfirm };
}
