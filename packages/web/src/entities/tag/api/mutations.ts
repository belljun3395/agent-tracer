import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TagId, TaskId } from "~web/shared/identity.js";
import type { TagCreateInput, TagUpdateInput } from "~web/entities/tag/model/tag.js";
import {
  createTag,
  deleteTag,
  setTaskTags,
  updateTag,
} from "~web/entities/tag/api/api-tags.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

function invalidateTags(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tagsPrefix() });
  void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskScopedPrefix() });
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TagCreateInput) => createTag(body),
    onSettled: () => invalidateTags(queryClient),
  });
}

export function useUpdateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, body }: { readonly tagId: TagId; readonly body: TagUpdateInput }) =>
      updateTag(tagId, body),
    onSettled: () => invalidateTags(queryClient),
  });
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: TagId) => deleteTag(tagId),
    onSettled: () => invalidateTags(queryClient),
  });
}

export function useSetTaskTagsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      tagIds,
    }: {
      readonly taskId: TaskId;
      readonly tagIds: readonly TagId[];
    }) => setTaskTags(taskId, tagIds),
    onSettled: () => invalidateTags(queryClient),
  });
}
