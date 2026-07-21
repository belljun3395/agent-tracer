import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatMessagesListResponse,
  ChatThreadsListResponse,
} from "~web/entities/chat/model/chat.js";
import { fetchChatMessages, fetchChatThreads } from "~web/entities/chat/api/api-chat.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useChatThreadsQuery(): UseQueryResult<ChatThreadsListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.chatThreads(),
    queryFn: fetchChatThreads,
  });
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
