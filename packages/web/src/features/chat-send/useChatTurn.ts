import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatBackend,
  ChatExecutionRecord,
  ChatExecutionsListResponse,
  ChatMessageRecord,
  ChatMessagesListResponse,
} from "~web/entities/chat/model/chat.js";
import type { ChatConfirmRequest } from "~web/entities/chat/model/chat-turn.js";
import { cancelChatExecution, startChatTurn } from "~web/entities/chat/api/api-chat.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";
import { useChatExecutionUpdates } from "~web/features/chat-send/useChatExecutionUpdates.js";

interface PendingMessage {
  readonly threadId: ChatThreadId;
  readonly clientRequestId: string;
  readonly content: string;
  readonly agentBackend?: ChatBackend;
  readonly status: "sending" | "accepted" | "failed";
  readonly error?: string;
  readonly acceptedMessage?: ChatMessageRecord;
}

export interface OptimisticChatMessage {
  readonly clientRequestId: string;
  readonly content: string;
  readonly status: "sending" | "failed";
  readonly error: string | null;
}

export interface UseChatTurnResult {
  readonly isStreaming: boolean;
  readonly pendingMessages: readonly OptimisticChatMessage[];
  readonly activeProcess: string;
  readonly completedProcesses: readonly {
    readonly assistantMessageId: string;
    readonly transcript: string;
  }[];
  readonly pendingConfirms: readonly ChatConfirmRequest[];
  readonly error: string | null;
  readonly queuedCount: number;
  readonly sendMessage: (content: string, agentBackend?: ChatBackend) => void;
  readonly stop: () => void;
  readonly retryMessage: (clientRequestId: string) => void;
  readonly dismissMessage: (clientRequestId: string) => void;
  readonly dismissConfirm: (confirmationId: string) => void;
}

/** 접수된 실행을 서버에서 다시 읽어 화면 이탈과 새로고침 뒤에도 같은 턴을 이어 본다. */
export function useChatTurn(threadId: ChatThreadId | null): UseChatTurnResult {
  const queryClient = useQueryClient();
  const executionsQuery = useChatExecutionUpdates(threadId);
  const [pendingMessages, setPendingMessages] = useState<readonly PendingMessage[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const seenTerminalRef = useRef(new Set<string>());
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  const executions = executionsQuery.data?.executions ?? [];
  const running =
    executions.find((execution) => execution.status === "running") ?? null;
  const queued = executions
    .filter((execution) => execution.status === "queued")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const latest = executions[0] ?? null;

  useEffect(() => {
    setPendingMessages([]);
    setRequestError(null);
    seenTerminalRef.current = new Set();
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    const accepted: ChatMessageRecord[] = [];
    for (const pending of pendingMessages) {
      if (pending.threadId !== threadId) continue;
      if (pending.status === "sending") break;
      if (pending.status === "accepted" && pending.acceptedMessage !== undefined) {
        accepted.push(pending.acceptedMessage);
      }
    }
    if (accepted.length === 0) return;
    const acceptedIds = new Set(accepted.map((message) => message.id));
    queryClient.setQueryData<ChatMessagesListResponse>(
      monitorQueryKeys.chatMessages(threadId),
      (current) => ({
        messages: [
          ...(current?.messages.filter((message) => !acceptedIds.has(message.id)) ?? []),
          ...accepted,
        ],
      }),
    );
    setPendingMessages((current) => current.filter((row) =>
      row.threadId !== threadId || row.status !== "accepted"));
  }, [pendingMessages, queryClient, threadId]);

  useEffect(() => {
    if (!threadId) return;
    const newlyTerminal = executions.filter(
      (execution) =>
        isTerminal(execution) && !seenTerminalRef.current.has(execution.id),
    );
    if (newlyTerminal.length === 0) return;
    for (const execution of newlyTerminal)
      seenTerminalRef.current.add(execution.id);
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.chatMessages(threadId),
      }),
      queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.chatThreadsPrefix(),
      }),
    ]);
  }, [executions, queryClient, threadId]);

  const submitPending = useCallback(
    (pending: PendingMessage) => {
      if (!threadId) return;
      void startChatTurn(threadId, {
        clientRequestId: pending.clientRequestId,
        content: pending.content,
        ...(pending.agentBackend ? { agentBackend: pending.agentBackend } : {}),
      })
        .then(async ({ message, execution }) => {
          queryClient.setQueryData<ChatExecutionsListResponse>(
            monitorQueryKeys.chatExecutions(threadId),
            (current) => ({
              confirmations: current?.confirmations ?? [],
              executions: [
                execution,
                ...(current?.executions.filter(
                  (row) => row.id !== execution.id,
                ) ?? []),
              ],
            }),
          );
          if (threadIdRef.current !== threadId) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatMessages(threadId) }),
              queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatExecutions(threadId) }),
            ]);
            return;
          }
          setPendingMessages((current) =>
            current.map((row) => {
              if (row.clientRequestId !== pending.clientRequestId) return row;
              const { error: _error, ...withoutError } = row;
              return { ...withoutError, status: "accepted", acceptedMessage: message };
            }),
          );
          await queryClient.invalidateQueries({
            queryKey: monitorQueryKeys.chatExecutions(threadId),
          });
        })
        .catch((error: unknown) => {
          if (threadIdRef.current !== threadId) return;
          setPendingMessages((current) =>
            current.map((row) => row.clientRequestId === pending.clientRequestId
              ? { ...row, status: "failed", error: toErrorMessage(error) }
              : row),
          );
          setRequestError(toErrorMessage(error));
        });
    },
    [queryClient, threadId],
  );

  const sendMessage = useCallback(
    (content: string, agentBackend?: ChatBackend) => {
      const trimmed = content.trim();
      if (!threadId || trimmed.length === 0) return;
      const pending: PendingMessage = {
        threadId,
        clientRequestId: globalThis.crypto.randomUUID(), content: trimmed, status: "sending",
        ...(agentBackend ? { agentBackend } : {}),
      };
      setPendingMessages((current) => [...current, pending]);
      setRequestError(null);
      submitPending(pending);
    },
    [submitPending, threadId],
  );

  const retryMessage = useCallback((clientRequestId: string) => {
    const pending = pendingMessages.find((row) => row.clientRequestId === clientRequestId);
    if (pending?.status !== "failed") return;
    const { error: _error, acceptedMessage: _acceptedMessage, ...retryable } = pending;
    const retrying: PendingMessage = { ...retryable, status: "sending" };
    setPendingMessages((current) => current.map((row) => row.clientRequestId === clientRequestId ? retrying : row));
    setRequestError(null);
    submitPending(retrying);
  }, [pendingMessages, submitPending]);

  const dismissMessage = useCallback((clientRequestId: string) => {
    setPendingMessages((current) => current.filter((row) => row.clientRequestId !== clientRequestId || row.status !== "failed"));
    setRequestError(null);
  }, []);

  const stop = useCallback(() => {
    if (!threadId) return;
    const target = running ?? queued[0];
    if (target === undefined) return;
    void cancelChatExecution(threadId, target.id)
      .then(({ execution }) => {
        queryClient.setQueryData<ChatExecutionsListResponse>(
          monitorQueryKeys.chatExecutions(threadId),
          (current) => ({
            confirmations: current?.confirmations ?? [],
            executions: current?.executions.map((row) =>
              row.id === execution.id ? execution : row,
            ) ?? [execution],
          }),
        );
      })
      .catch((error: unknown) => setRequestError(toErrorMessage(error)));
  }, [queryClient, queued, running, threadId]);

  const dismissConfirm = useCallback(
    (confirmationId: string) => {
      queryClient.setQueryData<ChatExecutionsListResponse>(
        threadId ? monitorQueryKeys.chatExecutions(threadId) : [],
        (current) =>
          current
            ? {
                ...current,
                confirmations: current.confirmations.filter(
                  (request) => request.id !== confirmationId,
                ),
              }
            : current,
      );
    },
    [queryClient, threadId],
  );

  return useMemo(
    () => ({
      isStreaming:
        running !== null || queued.length > 0 || pendingMessages.some((row) => row.status !== "failed"),
      pendingMessages: pendingMessages.filter((message) => message.threadId === threadId).map((message) => ({
        clientRequestId: message.clientRequestId,
        content: message.content,
        status: message.status === "failed" ? "failed" as const : "sending" as const,
        error: message.error ?? null,
      })),
      activeProcess: running?.draftText ?? "",
      completedProcesses: executions.flatMap((execution) =>
        execution.status === "completed" && execution.assistantMessageId !== null
          ? [{ assistantMessageId: execution.assistantMessageId, transcript: execution.draftText }]
          : [],
      ),
      pendingConfirms: executionsQuery.data?.confirmations ?? [],
      error:
        requestError ??
        (latest?.status === "failed"
          ? (latest.error ?? "Chat execution failed")
          : null),
      queuedCount:
        queued.length +
        Math.max(0, pendingMessages.filter((message) => message.status !== "failed").length - 1),
      sendMessage,
      stop,
      retryMessage,
      dismissMessage,
      dismissConfirm,
    }),
    [
      dismissConfirm,
      latest,
      executionsQuery.data?.confirmations,
      executions,
      pendingMessages,
      queued.length,
      requestError,
      retryMessage,
      dismissMessage,
      running,
      sendMessage,
      stop,
    ],
  );
}

function isTerminal(execution: ChatExecutionRecord): boolean {
  return (
    execution.status === "completed" ||
    execution.status === "failed" ||
    execution.status === "canceled"
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
