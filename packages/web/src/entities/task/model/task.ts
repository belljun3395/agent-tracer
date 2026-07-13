import type {
  RuntimeSource,
  SessionId,
  TaskId,
  TaskSlug,
  WorkspacePath,
} from "~web/shared/identity.js";

export type MonitoringTaskKind = "primary" | "background";
export type MonitoringTaskOrigin = "user" | "server-sdk";
export type MonitoringTaskStatus = "running" | "waiting" | "completed" | "errored";

export interface MonitoringTask {
  readonly id: TaskId;
  readonly title: string;
  readonly slug: TaskSlug;
  readonly workspacePath?: WorkspacePath;
  readonly status: MonitoringTaskStatus;
  readonly taskKind?: MonitoringTaskKind;
  readonly parentTaskId?: TaskId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSessionStartedAt?: string;
  readonly runtimeSource?: RuntimeSource;
  readonly displayTitle?: string;
  readonly archived?: boolean;
  readonly origin?: MonitoringTaskOrigin;
}

export interface MonitoringSession {
  readonly id: SessionId;
  readonly taskId: TaskId;
  readonly status: "running" | "completed" | "errored";
  readonly summary?: string;
  readonly startedAt: string;
  readonly endedAt?: string;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly status?: MonitoringTaskStatus;
}

export interface UpdateTaskResult {
  readonly task: MonitoringTask;
}
