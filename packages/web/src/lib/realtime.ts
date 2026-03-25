import type { MonitoringSession } from "@monitor/core";
import type {
  BookmarkRecord,
  MonitoringTask,
  OverviewResponse,
  TimelineEvent
} from "../types.js";

export type MonitorRealtimeMessage =
  | {
    readonly type: "snapshot";
    readonly payload: {
      readonly stats: OverviewResponse["stats"];
      readonly tasks: readonly MonitoringTask[];
    };
  }
  | {
    readonly type: "task.started" | "task.completed" | "task.updated";
    readonly payload: MonitoringTask;
  }
  | {
    readonly type: "task.deleted";
    readonly payload: { readonly taskId: string };
  }
  | {
    readonly type: "session.started" | "session.ended";
    readonly payload: MonitoringSession;
  }
  | {
    readonly type: "event.logged" | "event.updated";
    readonly payload: TimelineEvent;
  }
  | {
    readonly type: "bookmark.saved";
    readonly payload: BookmarkRecord;
  }
  | {
    readonly type: "bookmark.deleted";
    readonly payload: { readonly bookmarkId: string };
  }
  | {
    readonly type: "tasks.purged";
    readonly payload: { readonly count: number };
  };

export function parseRealtimeMessage(raw: string): MonitorRealtimeMessage | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown };
    return typeof value.type === "string"
      ? value as MonitorRealtimeMessage
      : null;
  } catch {
    return null;
  }
}

function shouldRefreshSelectedTaskDetail(
  message: MonitorRealtimeMessage,
  selectedTaskId: string | null
): boolean {
  if (!selectedTaskId) {
    return false;
  }

  switch (message.type) {
    case "snapshot":
      return true;
    case "task.started":
    case "task.completed":
    case "task.updated":
      return message.payload.id === selectedTaskId;
    case "task.deleted":
    case "tasks.purged":
      return false;
    case "session.started":
    case "session.ended":
      return message.payload.taskId === selectedTaskId;
    case "event.logged":
    case "event.updated":
      return message.payload.taskId === selectedTaskId;
    case "bookmark.saved":
    case "bookmark.deleted":
      return false;
  }
}

export async function refreshRealtimeMonitorData(input: {
  message: MonitorRealtimeMessage | null;
  selectedTaskId: string | null;
  refreshOverview: () => Promise<void>;
  refreshTaskDetail: (taskId: string) => Promise<void>;
  refreshBookmarksOnly: () => Promise<void>;
}): Promise<void> {
  if (!input.message) {
    await Promise.all([
      input.refreshOverview(),
      ...(input.selectedTaskId ? [input.refreshTaskDetail(input.selectedTaskId)] : [])
    ]);
    return;
  }

  switch (input.message.type) {
    case "bookmark.saved":
    case "bookmark.deleted":
      await input.refreshBookmarksOnly();
      return;
    case "event.updated":
      if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId) {
        await input.refreshTaskDetail(input.selectedTaskId);
      }
      return;
    case "event.logged":
      await Promise.all([
        input.refreshOverview(),
        ...(shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId
          ? [input.refreshTaskDetail(input.selectedTaskId)]
          : [])
      ]);
      return;
    case "task.deleted":
    case "tasks.purged":
      await input.refreshOverview();
      return;
    case "snapshot":
    case "task.started":
    case "task.completed":
    case "task.updated":
    case "session.started":
    case "session.ended":
      await Promise.all([
        input.refreshOverview(),
        ...(shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId
          ? [input.refreshTaskDetail(input.selectedTaskId)]
          : [])
      ]);
      return;
  }
}
