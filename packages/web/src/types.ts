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

export interface ObservabilityRuntimeSource {
  readonly runtimeSource: string;
  readonly taskCount: number;
  readonly runningTaskCount: number;
  readonly promptCaptureRate: number;
  readonly traceLinkedTaskRate: number;
}

export interface OverviewObservability {
  readonly generatedAt: string;
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly staleRunningTasks: number;
  readonly avgDurationMs: number;
  readonly avgEventsPerTask: number;
  readonly promptCaptureRate: number;
  readonly traceLinkedTaskRate: number;
  readonly tasksWithQuestions: number;
  readonly tasksWithTodos: number;
  readonly tasksWithCoordination: number;
  readonly tasksWithBackground: number;
  readonly runtimeSources: readonly ObservabilityRuntimeSource[];
}

export interface TaskObservabilityPhase {
  readonly phase: string;
  readonly durationMs: number;
  readonly share: number;
}

export interface TaskObservabilitySignalSummary {
  readonly rawUserMessages: number;
  readonly followUpMessages: number;
  readonly questionsAsked: number;
  readonly questionsClosed: number;
  readonly questionClosureRate: number;
  readonly todosAdded: number;
  readonly todosCompleted: number;
  readonly todoCompletionRate: number;
  readonly thoughts: number;
  readonly toolCalls: number;
  readonly terminalCommands: number;
  readonly verifications: number;
  readonly coordinationActivities: number;
  readonly backgroundTransitions: number;
  readonly exploredFiles: number;
}

export interface TaskObservabilityFocusSummary {
  readonly workItemIds: readonly string[];
  readonly goalIds: readonly string[];
  readonly planIds: readonly string[];
  readonly handoffIds: readonly string[];
  readonly topFiles: readonly {
    readonly path: string;
    readonly count: number;
  }[];
  readonly topTags: readonly {
    readonly tag: string;
    readonly count: number;
  }[];
}

export interface TaskObservabilitySummary {
  readonly taskId: string;
  readonly runtimeSource?: string;
  readonly totalDurationMs: number;
  readonly activeDurationMs: number;
  readonly totalEvents: number;
  readonly traceLinkCount: number;
  readonly traceLinkedEventCount: number;
  readonly traceLinkEligibleEventCount: number;
  readonly traceLinkCoverageRate: number;
  readonly actionRegistryGapCount: number;
  readonly actionRegistryEligibleEventCount: number;
  readonly phaseBreakdown: readonly TaskObservabilityPhase[];
  readonly sessions: {
    readonly total: number;
    readonly resumed: number;
    readonly open: number;
  };
  readonly signals: TaskObservabilitySignalSummary;
  readonly focus: TaskObservabilityFocusSummary;
}

export interface TaskObservabilityResponse {
  readonly observability: TaskObservabilitySummary;
}

export interface OverviewResponse {
  readonly stats: OverviewStats;
  readonly observability?: OverviewObservability | null;
}

export interface TasksResponse {
  readonly tasks: readonly MonitoringTask[];
}

export interface TaskDetailResponse {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEvent[];
}
