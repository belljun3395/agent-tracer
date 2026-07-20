import type { QueryClient } from "@tanstack/react-query";
import { TaskId } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type {
  TaskDetailResponse,
  TasksResponse,
} from "~web/entities/task/model/task-query.js";
import { appendToTimelineWindow } from "~web/entities/task/model/timeline/timeline-window.js";
import { toTimelineRecord } from "~web/entities/task/api/task.mapper.js";
import type { MonitorRealtimeMessage } from "~web/app/realtime/messages.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

/** 실시간 알림을 React Query의 읽기 모델에 반영한다. */
export function syncMonitorCache(
  client: QueryClient,
  message: MonitorRealtimeMessage,
  selectedTaskId: TaskId | null,
): void {
  switch (message.type) {
    case "tasks.purged":
      invalidate(client, ["monitor"]);
      return;
    case "task.started":
    case "task.updated":
      patchTasksCache(client, message.payload);
      invalidate(client, monitorQueryKeys.tasksPrefix());
      if (selectedTaskId && message.payload.id === selectedTaskId) {
        patchTaskDetailTask(client, selectedTaskId, message.payload);
      }
      return;
    case "task.deleted": {
      const deleted = TaskId(message.payload.taskId);
      removeTaskFromCache(client, deleted);
      invalidate(client, monitorQueryKeys.tasksPrefix());
      client.removeQueries({ queryKey: monitorQueryKeys.taskDetail(deleted) });
      client.removeQueries({ queryKey: monitorQueryKeys.taskOpenInference(deleted) });
      client.removeQueries({ queryKey: monitorQueryKeys.taskRules(deleted) });
      return;
    }
    case "event.logged":
    case "event.updated": {
      if (!selectedTaskId || message.payload.taskId !== selectedTaskId) return;
      patchTaskDetailTimeline(
        client,
        selectedTaskId,
        toTimelineRecord(message.payload),
        message.type === "event.logged" ? "append" : "replace",
      );
      invalidate(client, monitorQueryKeys.taskOpenInference(selectedTaskId));
      return;
    }
    case "rule_enforcement.added": {
      const affected = TaskId(message.payload.taskId);
      invalidate(
        client,
        monitorQueryKeys.taskDetail(affected),
        monitorQueryKeys.taskOpenInference(affected),
      );
      return;
    }
    case "verdict.updated": {
      const affected = TaskId(message.payload.taskId);
      invalidate(client, monitorQueryKeys.taskDetail(affected));
      return;
    }
    case "rules.changed":
      syncRulesChange(client, message.payload.taskId);
      return;
    case "sdk_job.updated":
      invalidate(
        client,
        monitorQueryKeys.jobsHistoryPrefix(),
        monitorQueryKeys.latestJobPrefix(message.payload.kind),
      );
      if (message.payload.jobId) {
        invalidate(client, monitorQueryKeys.job(message.payload.jobId));
      }
      return;
    case "session.started":
    case "session.ended":
      return;
    default:
      if (import.meta.env.DEV) {
        const unhandled = message as { readonly type: string };
        console.warn(`[useMonitorSocket] unhandled notification type: ${unhandled.type}`);
      }
      return;
  }
}

function syncRulesChange(client: QueryClient, taskId: string | undefined): void {
  if (!taskId) {
    invalidate(client, monitorQueryKeys.rules(), ["monitor", "task"]);
    return;
  }
  const affected = TaskId(taskId);
  invalidate(
    client,
    monitorQueryKeys.rules(),
    monitorQueryKeys.taskRules(affected),
    monitorQueryKeys.taskDetail(affected),
  );
}

function invalidate(
  client: QueryClient,
  ...queryKeys: readonly (readonly unknown[])[]
): void {
  for (const queryKey of queryKeys) {
    void client.invalidateQueries({ queryKey });
  }
}

function patchTasksCache(client: QueryClient, next: MonitoringTask): void {
  client.setQueryData<TasksResponse | undefined>(
    monitorQueryKeys.tasks("active"),
    (previous) => updateTaskList(client, previous, next, false),
  );
  client.setQueryData<TasksResponse | undefined>(
    monitorQueryKeys.tasks("archived"),
    (previous) => updateTaskList(client, previous, next, true),
  );
}

function updateTaskList(
  client: QueryClient,
  previous: TasksResponse | undefined,
  next: MonitoringTask,
  archived: boolean,
): TasksResponse | undefined {
  if (!previous) {
    if (!archived) {
      void client.invalidateQueries({ queryKey: monitorQueryKeys.tasksPrefix() });
    }
    return previous;
  }
  const index = previous.tasks.findIndex((task) => task.id === next.id);
  const belongs = Boolean(next.archived) === archived;
  if (!belongs) {
    if (index === -1) return previous;
    const tasks = previous.tasks.slice();
    tasks.splice(index, 1);
    return { tasks };
  }
  if (index === -1) return { tasks: [next, ...previous.tasks] };
  const tasks = previous.tasks.slice();
  tasks[index] = next;
  return { tasks };
}

function removeTaskFromCache(client: QueryClient, taskId: TaskId): void {
  for (const scope of ["active", "archived", "all"] as const) {
    client.setQueryData<TasksResponse | undefined>(
      monitorQueryKeys.tasks(scope),
      (previous) => {
        if (!previous) return previous;
        const tasks = previous.tasks.filter((task) => task.id !== taskId);
        return tasks.length === previous.tasks.length ? previous : { tasks };
      },
    );
  }
}

function patchTaskDetailTask(
  client: QueryClient,
  taskId: TaskId,
  next: MonitoringTask,
): void {
  client.setQueryData<TaskDetailResponse | undefined>(
    monitorQueryKeys.taskDetail(taskId),
    (previous) => (previous ? { ...previous, task: next } : previous),
  );
}

function patchTaskDetailTimeline(
  client: QueryClient,
  taskId: TaskId,
  event: TimelineEventRecord,
  mode: "append" | "replace",
): void {
  client.setQueryData<TaskDetailResponse | undefined>(
    monitorQueryKeys.taskDetail(taskId),
    (previous) => {
      if (!previous) {
        void client.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId) });
        return previous;
      }
      if (mode === "replace") {
        const index = previous.timeline.findIndex((item) => item.id === event.id);
        if (index !== -1) {
          const timeline = previous.timeline.slice();
          timeline[index] = event;
          return { ...previous, timeline };
        }
      }
      return {
        ...previous,
        timeline: appendToTimelineWindow(previous.timeline, event),
      };
    },
  );
}
