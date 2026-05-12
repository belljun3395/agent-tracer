import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MonitoringTask, TaskId } from "~domain/monitoring.js";
import type {
  TaskDetailResponse,
  TasksResponse,
} from "~domain/task-query-contracts.js";
import type { RuleCreateInput, RuleUpdateInput } from "~domain/rule.js";
import {
  acceptTaskCleanupSuggestion,
  archiveTask,
  createRule,
  demoteRule,
  deleteAppSetting,
  deleteRule,
  deleteTask,
  dismissTaskCleanupSuggestion,
  enqueueGenerateRules,
  enqueueTaskCleanupScan,
  promoteRule,
  putAppSetting,
  reEvaluateRule,
  unarchiveTask,
  updateRule,
  updateTask,
  type UpdateTaskBody,
} from "~io/api.js";
import { monitorQueryKeys } from "./queryKeys.js";

export function useDemoteRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, taskId }: { ruleId: string; taskId: TaskId }) =>
      demoteRule(ruleId, taskId),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskRules(vars.taskId),
      });
    },
  });
}

export function useEnqueueGenerateRulesMutation() {
  return useMutation({
    mutationFn: (taskId: TaskId) => enqueueGenerateRules(taskId),
  });
}

export function usePutAppSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      putAppSetting(key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.settings() });
    },
  });
}

export function useDeleteAppSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => deleteAppSetting(key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.settings() });
    },
  });
}

/**
 * Delete a task by id.
 *
 * - Optimistic update: removes the task from `useTasksQuery`'s cache
 *   immediately, so the sidebar feels snappy.
 * - On error: restores the previous list. The caller can also surface
 *   a transient "delete failed" badge via `error` returned from useMutation.
 * - WS bridge already handles `task.deleted` invalidation (removeQueries
 *   on taskDetail/openinference/taskRules), so no extra cleanup here.
 */
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
          tasks: previous.tasks.filter((t) => t.id !== taskId),
        });
      }
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(monitorQueryKeys.tasks(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.tasksPrefix(),
      });
    },
  });
}

/**
 * Archive a task. Soft-hides it from the default tasks list; the row is
 * preserved (unlike delete) and recoverable via useUnarchiveTaskMutation.
 * Optimistically removes from the active-scope cache for snappy feedback.
 */
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
          tasks: previous.tasks.filter((t) => t.id !== taskId),
        });
      }
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          monitorQueryKeys.tasks("active"),
          context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.tasksPrefix(),
      });
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
          tasks: previous.tasks.filter((t) => t.id !== taskId),
        });
      }
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          monitorQueryKeys.tasks("archived"),
          context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.tasksPrefix(),
      });
    },
  });
}

/**
 * Patch a task — title, status, or both at once.
 *
 * Optimistic update strategy: write the new fields into BOTH the tasks
 * list cache (so sidebar refreshes instantly) AND the task detail cache
 * (so TaskHeader / FeedPanel re-render without flicker). On error,
 * restore both. WS will eventually emit `task.updated` and reconcile.
 */
export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      body,
    }: {
      readonly taskId: TaskId;
      readonly body: UpdateTaskBody;
    }) => updateTask(taskId, body),
    onMutate: async ({ taskId, body }) => {
      const tasksKey = monitorQueryKeys.tasks();
      const detailKey = monitorQueryKeys.taskDetail(taskId);
      await queryClient.cancelQueries({ queryKey: tasksKey });
      await queryClient.cancelQueries({ queryKey: detailKey });
      const prevTasks = queryClient.getQueryData<TasksResponse>(tasksKey);
      const prevDetail = queryClient.getQueryData<TaskDetailResponse>(detailKey);
      const apply = (t: MonitoringTask): MonitoringTask => ({
        ...t,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date().toISOString(),
      });
      if (prevTasks) {
        queryClient.setQueryData<TasksResponse>(tasksKey, {
          ...prevTasks,
          tasks: prevTasks.tasks.map((t) => (t.id === taskId ? apply(t) : t)),
        });
      }
      if (prevDetail && prevDetail.task.id === taskId) {
        queryClient.setQueryData<TaskDetailResponse>(detailKey, {
          ...prevDetail,
          task: apply(prevDetail.task),
        });
      }
      return { prevTasks, prevDetail };
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(monitorQueryKeys.tasks(), context.prevTasks);
      }
      if (context?.prevDetail) {
        queryClient.setQueryData(
          monitorQueryKeys.taskDetail(taskId),
          context.prevDetail,
        );
      }
    },
    onSettled: (_data, _err, { taskId }) => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.tasksPrefix(),
      });
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskDetail(taskId),
      });
    },
  });
}

/**
 * Delete a rule by id. Invalidates both the global rules list AND any
 * task-scoped rule caches — the rule could have been listed in either
 * tab depending on its scope.
 */
export function useDeleteRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteRule(ruleId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["monitor", "rules"] });
      void queryClient.invalidateQueries({ queryKey: ["monitor", "task"] });
    },
  });
}

/**
 * Promote a task-scoped rule to global. Same invalidation footprint as
 * delete because both task-scope and global lists need to refresh
 * (the rule moves from one to the other).
 */
export function usePromoteRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => promoteRule(ruleId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["monitor", "rules"] });
      void queryClient.invalidateQueries({ queryKey: ["monitor", "task"] });
    },
  });
}

/**
 * Re-evaluate a rule against (optionally) a specific task. The server
 * re-runs the classifier; we invalidate the task detail so the freshly
 * computed matches surface immediately on Inspector → Rules and the
 * timeline lane reclassification.
 */
/**
 * Create a new rule. The server returns the persisted RuleRecord; we
 * don't try to optimistically prepend it to the list cache because the
 * server fills `id`, `signature`, and `createdAt`. Invalidate-and-refetch
 * is simpler and the form modal closes immediately on success anyway.
 */
export function useCreateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RuleCreateInput) => createRule(body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["monitor", "rules"] });
      void queryClient.invalidateQueries({ queryKey: ["monitor", "task"] });
    },
  });
}

/**
 * Update an existing rule's editable fields (name / trigger / expect /
 * severity / rationale). Same invalidation footprint as create — the
 * rule could be in either the global or task-scoped list depending on
 * scope.
 */
export function useUpdateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, body }: { readonly ruleId: string; readonly body: RuleUpdateInput }) =>
      updateRule(ruleId, body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["monitor", "rules"] });
      void queryClient.invalidateQueries({ queryKey: ["monitor", "task"] });
    },
  });
}

export function useReEvaluateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, taskId }: { readonly ruleId: string; readonly taskId?: TaskId }) =>
      reEvaluateRule(ruleId, taskId ? { taskId } : undefined),
    onSettled: (_data, _err, variables) => {
      if (variables.taskId) {
        void queryClient.invalidateQueries({
          queryKey: monitorQueryKeys.taskDetail(variables.taskId),
        });
        void queryClient.invalidateQueries({
          queryKey: monitorQueryKeys.taskRules(variables.taskId),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["monitor", "task"] });
      }
    },
  });
}

export function useEnqueueTaskCleanupScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enqueueTaskCleanupScan,
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskCleanupLatestJob(),
      });
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskCleanupSuggestionsPrefix(),
      });
    },
  });
}

export function useAcceptCleanupSuggestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => acceptTaskCleanupSuggestion(suggestionId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskCleanupSuggestionsPrefix(),
      });
      // Applying a suggestion mutates the underlying task — refresh task lists too.
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.tasksPrefix(),
      });
    },
  });
}

export function useDismissCleanupSuggestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => dismissTaskCleanupSuggestion(suggestionId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskCleanupSuggestionsPrefix(),
      });
    },
  });
}
