import type {
  EventClassification,
  EventClassificationMatch,
  EventClassificationReason,
  MonitoringTask,
  TaskEvaluation,
  TimelineEvent,
  TimelineLane,
  WorkflowSummary
} from "@monitor/core";

export type {
  EventClassification,
  EventClassificationMatch,
  EventClassificationReason,
  MonitoringTask,
  TaskEvaluation,
  TimelineEvent,
  TimelineLane,
  WorkflowSummary
};

export interface TimelineRelation {
  readonly sourceEventId: string;
  readonly targetEventId: string;
  readonly relationType?: string;
  readonly label?: string;
  readonly explanation?: string;
  readonly isExplicit: boolean;
  readonly workItemId?: string;
  readonly goalId?: string;
  readonly planId?: string;
  readonly handoffId?: string;
}

export interface BookmarkRecord {
  readonly id: string;
  readonly kind: "task" | "event";
  readonly taskId: string;
  readonly eventId?: string;
  readonly title: string;
  readonly note?: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly taskTitle?: string;
  readonly eventTitle?: string;
}

export interface BookmarksResponse {
  readonly bookmarks: readonly BookmarkRecord[];
}

export interface TaskSearchHit {
  readonly id: string;
  readonly taskId: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly status: MonitoringTask["status"];
  readonly updatedAt: string;
}

export interface EventSearchHit {
  readonly id: string;
  readonly eventId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly title: string;
  readonly snippet?: string;
  readonly lane: TimelineLane;
  readonly kind: string;
  readonly createdAt: string;
}

export interface BookmarkSearchHit {
  readonly id: string;
  readonly bookmarkId: string;
  readonly taskId: string;
  readonly eventId?: string;
  readonly kind: "task" | "event";
  readonly title: string;
  readonly note?: string;
  readonly taskTitle?: string;
  readonly eventTitle?: string;
  readonly createdAt: string;
}

export interface SearchResponse {
  readonly tasks: readonly TaskSearchHit[];
  readonly events: readonly EventSearchHit[];
  readonly bookmarks: readonly BookmarkSearchHit[];
}

export interface OverviewStats {
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly waitingTasks: number;
  readonly completedTasks: number;
  readonly erroredTasks: number;
  readonly totalEvents: number;
}

export interface OverviewResponse {
  readonly stats: OverviewStats;
}

export interface TasksResponse {
  readonly tasks: readonly MonitoringTask[];
}

export interface TaskDetailResponse {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEvent[];
}
