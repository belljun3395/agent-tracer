import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatExecutionRecord,
  ChatExecutionsListResponse,
} from "~web/entities/chat/model/chat.js";
import { useChatExecutionsQuery } from "~web/entities/chat/api/queries.js";
import { watchChatExecution } from "~web/entities/chat/api/watch-chat-execution.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useChatExecutionUpdates(threadId: ChatThreadId | null) {
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle");
  const executionsQuery = useChatExecutionsQuery(threadId, streamStatus);
  const active = findActiveExecution(executionsQuery.data?.executions ?? []);

  useEffect(() => {
    if (!threadId || active === null) {
      setStreamStatus("idle");
      return;
    }
    const controller = new AbortController();
    let retryDelayMs = 1_000;

    const watch = async (): Promise<void> => {
      while (!controller.signal.aborted) {
        setStreamStatus((current) => (current === "failed" ? current : "connecting"));
        try {
          const outcome = await watchChatExecution(
            threadId,
            active.id,
            {
              onOpen: () => {
                retryDelayMs = 1_000;
                setStreamStatus("connected");
              },
              onSnapshot: (snapshot) => {
                queryClient.setQueryData<ChatExecutionsListResponse>(
                  monitorQueryKeys.chatExecutions(threadId),
                  (current) => ({
                    executions: mergeExecution(current?.executions ?? [], snapshot.execution),
                    confirmations: snapshot.confirmations,
                  }),
                );
              },
            },
            controller.signal,
          );
          if (outcome === "terminal") return;
        } catch (error) {
          if (isAbortError(error)) return;
        }
        setStreamStatus("failed");
        await abortableDelay(retryDelayMs, controller.signal);
        retryDelayMs = Math.min(retryDelayMs * 2, 10_000);
      }
    };

    void watch();
    return () => controller.abort();
  }, [active?.id, queryClient, threadId]);

  return executionsQuery;
}

function findActiveExecution(
  executions: readonly ChatExecutionRecord[],
): ChatExecutionRecord | null {
  const running = executions.find((execution) => execution.status === "running");
  if (running !== undefined) return running;
  return (
    executions
      .filter((execution) => execution.status === "queued")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null
  );
}

function mergeExecution(
  executions: readonly ChatExecutionRecord[],
  incoming: ChatExecutionRecord,
): readonly ChatExecutionRecord[] {
  const current = executions.find((execution) => execution.id === incoming.id);
  if (current !== undefined && current.updatedAt > incoming.updatedAt) return executions;
  return [incoming, ...executions.filter((execution) => execution.id !== incoming.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function abortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
