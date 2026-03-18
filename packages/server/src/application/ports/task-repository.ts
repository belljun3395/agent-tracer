/**
 * @module application/ports/task-repository
 *
 * 태스크 저장소 포트.
 */

import type { MonitoringTask } from "@monitor/core";

export interface TaskUpsertInput {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: MonitoringTask["status"];
  readonly taskKind: NonNullable<MonitoringTask["taskKind"]>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSessionStartedAt?: string;
  readonly workspacePath?: string;
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
  readonly backgroundTaskId?: string;
  readonly runtimeSource?: string;
}

export interface ITaskRepository {
  upsert(input: TaskUpsertInput): Promise<MonitoringTask>;
  findById(id: string): Promise<MonitoringTask | null>;
  findAll(): Promise<readonly MonitoringTask[]>;
  findChildren(parentId: string): Promise<readonly MonitoringTask[]>;
  updateStatus(id: string, status: MonitoringTask["status"], updatedAt: string): Promise<void>;
  updateTitle(id: string, title: string, slug: string, updatedAt: string): Promise<void>;
  delete(id: string): Promise<{ deletedIds: readonly string[] }>;
  deleteFinished(): Promise<number>;
  getOverviewStats(): Promise<OverviewStats>;
}

export interface OverviewStats {
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly waitingTasks: number;
  readonly completedTasks: number;
  readonly erroredTasks: number;
  readonly totalEvents: number;
}
