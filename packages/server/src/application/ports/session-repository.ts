/**
 * @module application/ports/session-repository
 *
 * 세션 저장소 포트.
 */

import type { MonitoringSession } from "@monitor/core";

export interface SessionCreateInput {
  readonly id: string;
  readonly taskId: string;
  readonly status: MonitoringSession["status"];
  readonly startedAt: string;
  readonly summary?: string;
}

export interface ISessionRepository {
  create(input: SessionCreateInput): Promise<MonitoringSession>;
  findById(id: string): Promise<MonitoringSession | null>;
  findByTaskId(taskId: string): Promise<readonly MonitoringSession[]>;
  /** 태스크의 마지막 running 세션 반환. */
  findActiveByTaskId(taskId: string): Promise<MonitoringSession | null>;
  updateStatus(
    id: string,
    status: MonitoringSession["status"],
    endedAt: string,
    summary?: string
  ): Promise<void>;
  /** 태스크의 running 세션 수 반환 (배경 태스크 자동완료 판단용). */
  countRunningByTaskId(taskId: string): Promise<number>;
}
