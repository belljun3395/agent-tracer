import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatThreadCreateInput } from "~web/entities/chat/model/chat.js";
import {
  confirmChatTool,
  createChatThread,
  deleteChatThread,
  renameChatThread,
  type ConfirmChatToolInput,
} from "~web/entities/chat/api/api-chat.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useCreateThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChatThreadCreateInput) => createChatThread(body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatThreadsPrefix() });
    },
  });
}

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: ChatThreadId) => deleteChatThread(threadId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatThreadsPrefix() });
    },
  });
}

export function useRenameThreadMutation(threadId: ChatThreadId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => renameChatThread(threadId, title),
    onSuccess: ({ thread }) => {
      queryClient.setQueryData<{ readonly threads: readonly (typeof thread)[] }>(
        monitorQueryKeys.chatThreads(),
        (current) => ({
          threads: current?.threads.map((row) => (row.id === thread.id ? thread : row)) ?? [thread],
        }),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatThreadsPrefix() });
    },
  });
}

export function useConfirmToolMutation(threadId: ChatThreadId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ConfirmChatToolInput, "threadId">) =>
      confirmChatTool({ ...input, threadId }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.chatMessages(threadId) });
    },
  });
}
