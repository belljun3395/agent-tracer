import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatExecutionRecord,
  ChatMessagesListResponse,
  ChatThreadsListResponse,
  ChatExecutionsListResponse,
} from "~web/entities/chat/model/chat.js";
import {
  fetchChatExecutions,
  fetchChatMessages,
  fetchChatThreads,
} from "~web/entities/chat/api/api-chat.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useChatThreadsQuery(): UseQueryResult<ChatThreadsListResponse> {
  return useQuery<ChatThreadsListResponse>({
    queryKey: monitorQueryKeys.chatThreads(),
    queryFn: fetchChatThreads,
  });
}

export function useChatExecutionsQuery(
  threadId: ChatThreadId | null,
  streamStatus: "idle" | "connecting" | "connected" | "failed" = "idle",
): UseQueryResult<ChatExecutionsListResponse> {
  const queryClient = useQueryClient();
  const queryKey = threadId
    ? monitorQueryKeys.chatExecutions(threadId)
    : monitorQueryKeys.chatExecutions("__disabled__" as ChatThreadId);
  return useQuery<ChatExecutionsListResponse>({
    queryKey,
    queryFn: async () => {
      if (!threadId) throw new Error("useChatExecutionsQuery called without a threadId");
      const incoming = await fetchChatExecutions(threadId);
      return mergeExecutionResponses(
        queryClient.getQueryData<ChatExecutionsListResponse>(queryKey),
        incoming,
      );
    },
    enabled: threadId !== null,
    refetchInterval: (query) => {
      return chatExecutionPollInterval(
        query.state.data?.executions ?? [],
        Date.now(),
        streamStatus === "failed",
        streamStatus === "connected",
      );
    },
  });
}

export function mergeExecutionResponses(
  previous: ChatExecutionsListResponse | undefined,
  incoming: ChatExecutionsListResponse,
): ChatExecutionsListResponse {
  if (previous === undefined) return incoming;
  const newestPrevious = Math.max(...previous.executions.map((row) => Date.parse(row.updatedAt)), 0);
  const newestIncoming = Math.max(...incoming.executions.map((row) => Date.parse(row.updatedAt)), 0);
  return newestPrevious > newestIncoming ? previous : incoming;
}

export function chatExecutionPollInterval(
  executions: readonly ChatExecutionRecord[],
  nowMs: number,
  fallback = false,
  connected = false,
): number | false {
  const active = executions.filter(
    (execution) => execution.status === "queued" || execution.status === "running",
  );
  if (active.length === 0) return false;
  if (connected) return 10_000;
  if (fallback) return 5_000;

  const activeSince = Math.min(
    ...active.map((execution) => {
      const timestamp = Date.parse(execution.startedAt ?? execution.createdAt);
      return Number.isFinite(timestamp) ? timestamp : nowMs;
    }),
  );
  const elapsedMs = Math.max(0, nowMs - activeSince);
  if (elapsedMs < 10_000) return 1_000;
  if (elapsedMs < 30_000) return 2_000;
  return 5_000;
}

export function useChatMessagesQuery(
  threadId: ChatThreadId | null,
): UseQueryResult<ChatMessagesListResponse> {
  return useQuery({
    queryKey: threadId
      ? monitorQueryKeys.chatMessages(threadId)
      : monitorQueryKeys.chatMessages("__disabled__" as ChatThreadId),
    queryFn: () => {
      if (!threadId) {
        throw new Error("useChatMessagesQuery called without a threadId");
      }
      return fetchChatMessages(threadId);
    },
    enabled: threadId !== null,
  });
}
