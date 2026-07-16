import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemoCreateInput, MemoUpdateInput } from "~web/entities/memo/model/memo.js";
import {
  createMemo,
  deleteMemo,
  updateMemo,
} from "~web/entities/memo/api/api-memos.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

function invalidateMemos(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.memosPrefix() });
  void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskScopedPrefix() });
}

export function useCreateMemoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MemoCreateInput) => createMemo(body),
    onSettled: () => invalidateMemos(queryClient),
  });
}

export function useUpdateMemoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memoId, body }: { readonly memoId: string; readonly body: MemoUpdateInput }) =>
      updateMemo(memoId, body),
    onSettled: () => invalidateMemos(queryClient),
  });
}

export function useDeleteMemoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memoId: string) => deleteMemo(memoId),
    onSettled: () => invalidateMemos(queryClient),
  });
}
