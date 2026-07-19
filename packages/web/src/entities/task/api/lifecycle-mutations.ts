import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { TasksResponse } from "~web/entities/task/model/task-query.js";
import { archiveTask, deleteTask, unarchiveTask } from "~web/entities/task/api/lifecycle.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

/** rootId와 그 아래 모든 깊이의 자손 id를 모은다. */
function collectSubtreeIds(
  tasks: readonly { readonly id: TaskId; readonly parentTaskId?: TaskId }[],
  rootId: TaskId,
): ReadonlySet<TaskId> {
  const out = new Set<TaskId>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const task of tasks) {
      if (out.has(task.id)) continue;
      const parent = task.parentTaskId;
      if (parent === undefined || !out.has(parent)) continue;
      out.add(task.id);
      grew = true;
    }
  }
  return out;
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: TaskId) => deleteTask(taskId),
    onMutate: async (taskId) => {
      const key = monitorQueryKeys.tasks();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TasksResponse>(key);
      if (previous) {
        // 서버가 자손까지 숨기므로 낙관적 갱신도 서브트리를 통째로 걷어내야 자식이 잠깐 루트로 튀지 않는다.
        const doomed = collectSubtreeIds(previous.tasks, taskId);
        queryClient.setQueryData<TasksResponse>(key, {
          ...previous,
          tasks: previous.tasks.filter((task) => !doomed.has(task.id)),
        });
      }
      return { previous };
    },
    onError: (_error, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(monitorQueryKeys.tasks(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasksPrefix() });
    },
  });
}

export function useArchiveTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: TaskId) => archiveTask(taskId),
    onMutate: async (taskId) => {
      const key = monitorQueryKeys.tasks("active");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TasksResponse>(key);
      if (previous) {
        queryClient.setQueryData<TasksResponse>(key, {
          ...previous,
          tasks: previous.tasks.filter((task) => task.id !== taskId),
        });
      }
      return { previous };
    },
    onError: (_error, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(monitorQueryKeys.tasks("active"), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasksPrefix() });
    },
  });
}

export function useUnarchiveTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: TaskId) => unarchiveTask(taskId),
    onMutate: async (taskId) => {
      const key = monitorQueryKeys.tasks("archived");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TasksResponse>(key);
      if (previous) {
        queryClient.setQueryData<TasksResponse>(key, {
          ...previous,
          tasks: previous.tasks.filter((task) => task.id !== taskId),
        });
      }
      return { previous };
    },
    onError: (_error, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(monitorQueryKeys.tasks("archived"), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasksPrefix() });
    },
  });
}
