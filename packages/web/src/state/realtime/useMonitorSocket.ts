import {
  TaskId,
  type MonitoringTask,
  type TimelineEventRecord,
} from "~domain/monitoring.js";
import type {
  TaskDetailResponse,
  TasksResponse,
} from "~domain/task-query-contracts.js";
import { parseRealtimeMessage } from "~io/realtime.js";
import type { MonitorRealtimeMessage } from "~io/realtime.js";
import { MonitorSocket } from "~io/websocket.js";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { monitorQueryKeys } from "../server/queryKeys.js";

export interface UseMonitorSocketOptions {
  readonly url: string;
  readonly selectedTaskId?: TaskId | null;
  readonly onConnectionChange?: (connected: boolean) => void;
  readonly onMessage?: (message: MonitorRealtimeMessage) => void;
}

export function useMonitorSocket(options: UseMonitorSocketOptions): void {
  const { url, selectedTaskId, onConnectionChange, onMessage } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = new MonitorSocket({ url });
    let closed = false;

    const offConnection = socket.on("connectionChange", (connected) => {
      if (!closed) {
        onConnectionChange?.(connected);
      }
    });
    const offMessage = socket.on("message", (raw) => {
      if (closed) {
        return;
      }
      const message = parseRealtimeMessage(raw);
      if (!message) return;
      applyMonitorRealtimeInvalidations(
        queryClient,
        message,
        selectedTaskId ?? null,
      );
      onMessage?.(message);
    });

    return () => {
      closed = true;
      offConnection();
      offMessage();
      socket.close();
    };
  }, [url, queryClient, selectedTaskId, onConnectionChange, onMessage]);
}

/**
 * Mirror server-side state-changing events into React Query cache state.
 *
 * Most events come with the new/updated row in the WS payload, so we
 * patch the cache directly via `setQueryData` instead of invalidating —
 * an `event.logged` for a 400-span task used to trigger a full timeline
 * refetch over HTTP for every keystroke from the agent. Patching keeps
 * the WS event itself the only network cost.
 *
 * Plain invalidations are kept for:
 *   - `snapshot` / `tasks.purged` (whole-cache reset)
 *   - `rule_enforcement.added` / `verdict.updated` (server-side
 *     classification changes the timeline content but the payload
 *     doesn't carry the resulting row)
 *
 * Only keys that have at least one active consumer in v1.2 are refreshed
 * — unused keys (overview, verdictCounts) used to be invalidated here
 * too but those queries have no hook subscribers, so the work was
 * wasted. React Query also short-circuits invalidations whose key has
 * no active observer, so OpenInference refetches only fire when the
 * Trace tab is mounted.
 */
function applyMonitorRealtimeInvalidations(
  client: QueryClient,
  message: MonitorRealtimeMessage,
  selectedTaskId: TaskId | null,
): void {
  switch (message.type) {
    case "snapshot":
    case "tasks.purged":
      void client.invalidateQueries({ queryKey: ["monitor"] });
      return;
    case "task.started":
    case "task.completed":
    case "task.updated": {
      patchTasksCache(client, message.payload);
      if (selectedTaskId && message.payload.id === selectedTaskId) {
        patchTaskDetailTask(client, selectedTaskId, message.payload);
      }
      return;
    }
    case "task.deleted": {
      const deleted = TaskId(message.payload.taskId);
      removeTaskFromCache(client, deleted);
      client.removeQueries({
        queryKey: monitorQueryKeys.taskDetail(deleted),
      });
      client.removeQueries({
        queryKey: monitorQueryKeys.taskOpenInference(deleted),
      });
      client.removeQueries({
        queryKey: monitorQueryKeys.taskRules(deleted),
      });
      return;
    }
    case "event.logged":
    case "event.updated": {
      if (!selectedTaskId) return;
      const event = message.payload;
      if (event.taskId !== selectedTaskId) return;
      patchTaskDetailTimeline(
        client,
        selectedTaskId,
        event,
        message.type === "event.logged" ? "append" : "replace",
      );
      // OpenInference is derived server-side from the same events, so
      // we still need a refetch when it's actively observed. React Query
      // skips the network call when no observer is mounted.
      void client.invalidateQueries({
        queryKey: monitorQueryKeys.taskOpenInference(selectedTaskId),
      });
      return;
    }
    case "rule_enforcement.added": {
      // Lane reclassification: refetch the affected task's timeline so
      // the event appears in the rule lane. We don't have the rewritten
      // event row in the payload, so this case still goes over HTTP.
      const affected = TaskId(message.payload.taskId);
      void client.invalidateQueries({
        queryKey: monitorQueryKeys.taskDetail(affected),
      });
      void client.invalidateQueries({
        queryKey: monitorQueryKeys.taskOpenInference(affected),
      });
      return;
    }
    case "verdict.updated": {
      const affected = TaskId(message.payload.taskId);
      void client.invalidateQueries({
        queryKey: monitorQueryKeys.taskDetail(affected),
      });
      return;
    }
    case "rules.changed": {
      void client.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
      if (message.payload.taskId) {
        const affected = TaskId(message.payload.taskId);
        void client.invalidateQueries({
          queryKey: monitorQueryKeys.taskRules(affected),
        });
        void client.invalidateQueries({
          queryKey: monitorQueryKeys.taskDetail(affected),
        });
      } else {
        // Cross-task rule edits: every cached task's classification might
        // shift, so blow the whole `task` namespace.
        void client.invalidateQueries({ queryKey: ["monitor", "task"] });
      }
      return;
    }
    case "session.started":
    case "session.ended":
      return;
  }
}

function patchTasksCache(
  client: QueryClient,
  next: MonitoringTask,
): void {
  client.setQueryData<TasksResponse | undefined>(
    monitorQueryKeys.tasks("active"),
    (prev) => {
      if (!prev) {
        void client.invalidateQueries({ queryKey: monitorQueryKeys.tasksPrefix() });
        return prev;
      }
      const idx = prev.tasks.findIndex((t) => t.id === next.id);
      if (next.archivedAt) {
        if (idx === -1) return prev;
        const tasks = prev.tasks.slice();
        tasks.splice(idx, 1);
        return { tasks };
      }
      if (idx === -1) return { tasks: [next, ...prev.tasks] };
      const tasks = prev.tasks.slice();
      tasks[idx] = next;
      return { tasks };
    },
  );
  client.setQueryData<TasksResponse | undefined>(
    monitorQueryKeys.tasks("archived"),
    (prev) => {
      if (!prev) return prev;
      const idx = prev.tasks.findIndex((t) => t.id === next.id);
      if (!next.archivedAt) {
        if (idx === -1) return prev;
        const tasks = prev.tasks.slice();
        tasks.splice(idx, 1);
        return { tasks };
      }
      if (idx === -1) return { tasks: [next, ...prev.tasks] };
      const tasks = prev.tasks.slice();
      tasks[idx] = next;
      return { tasks };
    },
  );
}

function removeTaskFromCache(client: QueryClient, taskId: TaskId): void {
  for (const scope of ["active", "archived", "all"] as const) {
    client.setQueryData<TasksResponse | undefined>(
      monitorQueryKeys.tasks(scope),
      (prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.filter((t) => t.id !== taskId);
        return tasks.length === prev.tasks.length ? prev : { tasks };
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
    (prev) => (prev ? { ...prev, task: next } : prev),
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
    (prev) => {
      if (!prev) {
        // No cached detail yet — fall back to invalidation so the next
        // observer fetches.
        void client.invalidateQueries({
          queryKey: monitorQueryKeys.taskDetail(taskId),
        });
        return prev;
      }
      if (mode === "replace") {
        const idx = prev.timeline.findIndex((e) => e.id === event.id);
        if (idx === -1) return { ...prev, timeline: [...prev.timeline, event] };
        const timeline = prev.timeline.slice();
        timeline[idx] = event;
        return { ...prev, timeline };
      }
      // append — deduplicate so retried sends don't double-render.
      if (prev.timeline.some((e) => e.id === event.id)) return prev;
      return { ...prev, timeline: [...prev.timeline, event] };
    },
  );
}
