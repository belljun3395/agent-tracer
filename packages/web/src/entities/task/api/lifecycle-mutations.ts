import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { TasksResponse } from "~web/entities/task/model/task-query.js";
import { archiveTask, deleteTask, unarchiveTask } from "~web/entities/task/api/lifecycle.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: TaskId) => deleteTask(taskId),
    onMutate: async (taskId) => {
      const key = monitorQueryKeys.tasks();
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
