import type { ResumeTargetDto, SessionDto } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { MonitoringTask, MonitoringTaskOrigin, MonitoringTaskStatus } from "~web/entities/task/model/task.js";

/** 엔티티 간 참조 없이 task 슬라이스가 소유하는 verdict 상태 표현이다. */
export type TaskTurnVerdictStatus = "verified" | "contradicted" | "unverifiable";

export type TasksArchivedScope = "active" | "archived" | "all";
export type TasksOriginFilter = MonitoringTaskOrigin | "all";
export type TasksStatusFilter = MonitoringTaskStatus | "all";

export interface TaskListQuery {
  readonly archived?: TasksArchivedScope;
  readonly origin?: TasksOriginFilter;
  readonly status?: TasksStatusFilter;
  readonly rootOnly?: boolean;
}

export interface TaskPageQuery extends TaskListQuery {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface TaskPageInfo {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

export interface TasksResponse {
  readonly tasks: readonly MonitoringTask[];
  readonly page?: TaskPageInfo;
}

export interface TaskChildrenResponse {
  readonly tasks: readonly MonitoringTask[];
}

export interface TaskDetailResponse {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEventRecord[];
  readonly olderCursor?: string | null;
  readonly sessions?: readonly SessionDto[];
  readonly resumeTarget?: ResumeTargetDto;
  readonly turns?: readonly TaskTurnSummary[];
}

export interface TaskTimelineResponse {
  readonly timeline: readonly TimelineEventRecord[];
  readonly olderCursor: string | null;
}

export interface TaskTurnsResponse {
  readonly turns: readonly TaskTurnSummary[];
}

export interface TaskTurnSummary {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly turnIndex: number;
  readonly status: "open" | "closed";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly aggregateVerdict: TaskTurnVerdictStatus | null;
  readonly rulesEvaluatedCount: number;
}

export interface TaskUserInput {
  readonly eventId: string;
  readonly text: string;
  readonly turnId: string | null;
  readonly occurredAt: string;
}

/** 스캔 앵커 후보를 사용자 완료 루트 태스크로 제한하는 목록 질의를 만든다. */
export function scanAnchorTaskQuery(includeArchived: boolean): TaskPageQuery {
  return {
    origin: "user",
    status: "completed",
    rootOnly: true,
    archived: includeArchived ? "all" : "active",
  };
}
