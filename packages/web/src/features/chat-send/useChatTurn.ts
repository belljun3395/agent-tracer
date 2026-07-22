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

/** 진행 중인 턴 뒤로 밀어 둔, 아직 서버에 append하지 않은 사용자 메시지 한 건이다. */
interface QueuedMessage {
  readonly content: string;
  readonly agentBackend?: ChatBackend;
}

interface ChatTurnState {
  readonly isStreaming: boolean;
  readonly assistantDraft: string;
  readonly toolActivity: readonly LiveToolActivity[];
  readonly pendingConfirms: readonly ChatConfirmRequest[];
  readonly memoryUpdates: readonly ChatMemoryUpdate[];
  readonly error: string | null;
  readonly queuedCount: number;
}

const EMPTY_STATE: ChatTurnState = {
  isStreaming: false,
  assistantDraft: "",
  toolActivity: [],
  pendingConfirms: [],
  memoryUpdates: [],
  error: null,
  queuedCount: 0,
};

export interface UseChatTurnResult extends ChatTurnState {
  readonly sendMessage: (content: string, agentBackend?: ChatBackend) => void;
  /** 진행 중인 턴을 사용자가 취소하고 대기열을 비우며, 백엔드는 취소된 부분 응답을 버린다. */
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
  // 응답 중에 온 전송을 취소 대신 순서대로 쌓아 두고, 앞 턴이 끝나면 하나씩 꺼내 새 턴으로 자동 시작한다.
  const queueRef = useRef<readonly QueuedMessage[]>([]);
  // sendMessage가 큐잉과 즉시 시작을 가르는 기준으로, 렌더 사이에 낡지 않게 상태 대신 이 값을 읽는다.
  const isStreamingRef = useRef(false);
  // 턴이 끝날 때 다음 대기 메시지를 시작하는 재귀 경로가 낡은 클로저를 잡지 않게, 최신 startTurn을 가리키는 참조다.
  const startTurnRef = useRef<(message: QueuedMessage) => void>(() => {});

  const startTurn = useCallback(
    (message: QueuedMessage) => {
      if (!threadId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      activeThreadRef.current = threadId;
      isStreamingRef.current = true;
      const turnSeq = (turnSeqRef.current += 1);

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        assistantDraft: "",
        toolActivity: [],
        error: null,
      }));

      // 밀려난 턴의 늦은 SSE가 현재 턴이나 새 스레드의 상태를 오염시키지 못하게, 이 턴의 일련번호가 아직 유효할 때만 이벤트를 반영한다.
      const isStale = () => turnSeqRef.current !== turnSeq;

      // 방금 끝난 턴 뒤에 대기 중인 메시지가 있으면 순서대로 다음 턴을 시작한다.
      const advanceQueue = () => {
        isStreamingRef.current = false;
        const [next, ...rest] = queueRef.current;
        if (next === undefined) return;
        queueRef.current = rest;
        setState((prev) => ({ ...prev, queuedCount: rest.length }));
        startTurnRef.current(next);
      };

      void streamChatMessage(
        threadId,
        {
          content: message.content,
          ...(message.agentBackend ? { agentBackend: message.agentBackend } : {}),
        },
        {
          onAssistantDelta: (text) => {
            if (isStale()) return;
            setState((prev) => ({ ...prev, assistantDraft: prev.assistantDraft + text }));
          },
          onToolCall: (call) => {
            if (isStale()) return;
            setState((prev) => ({
              ...prev,
              toolActivity: [...prev.toolActivity, { call, result: null }],
            }));
          },
          onToolResult: (result) => {
            if (isStale()) return;
            setState((prev) => ({
              ...prev,
              toolActivity: prev.toolActivity.map((activity) =>
                activity.call.id === result.toolCallId ? { ...activity, result } : activity,
              ),
            }));
          },
          onConfirmRequest: (request) => {
            if (isStale()) return;
            setState((prev) => ({
              ...prev,
              pendingConfirms: [...prev.pendingConfirms, request],
            }));
          },
          onMemoryUpdated: (update) => {
            if (isStale()) return;
            setState((prev) => ({ ...prev, memoryUpdates: [...prev.memoryUpdates, update] }));
          },
          onDone: () => {
            if (isStale()) return;
            // 빈 말풍선이 번쩍이지 않도록, 스트리밍한 텍스트를 그대로 둔 채 히스토리를 다시 불러오고 저장된 메시지가 자리를 잡은 뒤에야 드래프트를 지운다.
            setState((prev) => ({ ...prev, isStreaming: false }));
            void queryClient
              .invalidateQueries({ queryKey: monitorQueryKeys.chatMessages(threadId) })
              .then(() => {
                if (isStale()) return;
                setState((prev) => ({ ...prev, assistantDraft: "", toolActivity: [] }));
                advanceQueue();
              });
          },
          onError: (message) => {
            if (isStale()) return;
            setState((prev) => ({ ...prev, isStreaming: false, error: message }));
            advanceQueue();
          },
        },
        controller.signal,
      );
    },
    [threadId, queryClient],
  );

  // done/error 뒤 다음 대기 메시지를 시작하는 재귀 경로가 항상 최신 startTurn을 부르게 참조를 맞춘다.
  useEffect(() => {
    startTurnRef.current = startTurn;
  }, [startTurn]);

  // 같은 스레드의 재렌더나 StrictMode 마운트 이펙트 재실행은 무시하고, 사용자가 스레드를 진짜로 바꿨을 때만 이전 턴을 끊고 대기열과 상태를 비운다.
  useEffect(() => {
    if (activeThreadRef.current === threadId) return;
    activeThreadRef.current = threadId;
    abortRef.current?.abort();
    abortRef.current = null;
    turnSeqRef.current += 1;
    isStreamingRef.current = false;
    queueRef.current = [];
    setState(EMPTY_STATE);
  }, [threadId]);

  const sendMessage = useCallback(
    (content: string, agentBackend?: ChatBackend) => {
      const trimmed = content.trim();
      if (!threadId || trimmed.length === 0) return;

      const message: QueuedMessage = { content: trimmed, ...(agentBackend ? { agentBackend } : {}) };

      // 진행 중인 턴이 있으면 취소하지 않고 대기열 끝에 쌓아 두며, POST는 이 메시지의 턴이 실제로 시작될 때만 일어난다.
      if (isStreamingRef.current) {
        queueRef.current = [...queueRef.current, message];
        setState((prev) => ({ ...prev, queuedCount: queueRef.current.length }));
        return;
      }

      startTurn(message);
    },
    [threadId, startTurn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    turnSeqRef.current += 1;
    isStreamingRef.current = false;
    queueRef.current = [];
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      assistantDraft: "",
      toolActivity: [],
      queuedCount: 0,
    }));
  }, []);

  const dismissConfirm = useCallback((confirmationId: string) => {
    setState((prev) => ({
      ...prev,
      pendingConfirms: prev.pendingConfirms.filter((request) => request.id !== confirmationId),
    }));
  }, []);

  return { ...state, sendMessage, stop, dismissConfirm };
}
