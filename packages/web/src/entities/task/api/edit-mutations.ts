import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { MonitoringTask, UpdateTaskInput } from "~web/entities/task/model/task.js";
import type { TaskDetailResponse, TasksResponse } from "~web/entities/task/model/task-query.js";
import { updateTask } from "~web/entities/task/api/lifecycle.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      body,
    }: {
      readonly taskId: TaskId;
      readonly body: UpdateTaskInput;
    }) => updateTask(taskId, body),
    onMutate: async ({ taskId, body }) => {
      const tasksKey = monitorQueryKeys.tasks();
      const detailKey = monitorQueryKeys.taskDetail(taskId);
      await queryClient.cancelQueries({ queryKey: tasksKey });
      await queryClient.cancelQueries({ queryKey: detailKey });
      const prevTasks = queryClient.getQueryData<TasksResponse>(tasksKey);
      const prevDetail = queryClient.getQueryData<TaskDetailResponse>(detailKey);
      const apply = (task: MonitoringTask): MonitoringTask => ({
        ...task,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date().toISOString(),
      });
      if (prevTasks) {
        queryClient.setQueryData<TasksResponse>(tasksKey, {
          ...prevTasks,
          tasks: prevTasks.tasks.map((task) => (task.id === taskId ? apply(task) : task)),
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
    onError: (_error, { taskId }, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(monitorQueryKeys.tasks(), context.prevTasks);
      }
      if (context?.prevDetail) {
        queryClient.setQueryData(monitorQueryKeys.taskDetail(taskId), context.prevDetail);
      }
    },
    onSettled: (_data, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasksPrefix() });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId) });
    },
  });
}
