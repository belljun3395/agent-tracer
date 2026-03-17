export type TimelineLane = "user" | "exploration" | "planning" | "implementation" | "rules" | "questions" | "todos" | "background";

export interface MonitoringTask {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly workspacePath?: string;
  readonly status: "running" | "completed" | "errored";
  readonly taskKind?: "primary" | "background";
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
  readonly backgroundTaskId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSessionStartedAt?: string;
  readonly cliSource?: string;
}

export interface EventClassificationReason {
  readonly kind: "keyword" | "prefix" | "action-prefix" | "action-keyword";
  readonly value: string;
}

export interface EventClassificationMatch {
  readonly ruleId: string;
  readonly source?: "rules-index" | "action-registry";
  readonly score: number;
  readonly lane?: TimelineLane;
  readonly tags: readonly string[];
  readonly reasons: readonly EventClassificationReason[];
}

export interface EventClassification {
  readonly lane: TimelineLane;
  readonly tags: readonly string[];
  readonly matches: readonly EventClassificationMatch[];
}

export interface TimelineEvent {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId?: string;
  readonly kind: string;
  readonly lane: TimelineLane;
  readonly title: string;
  readonly body?: string;
  readonly metadata: Record<string, unknown>;
  readonly classification: EventClassification;
  readonly createdAt: string;
}

export interface OverviewStats {
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly completedTasks: number;
  readonly erroredTasks: number;
  readonly totalEvents: number;
}

export interface RulesIndex {
  readonly version: number;
  readonly rules: readonly {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly lane?: TimelineLane;
    readonly prefixes: readonly string[];
    readonly keywords: readonly string[];
    readonly tags: readonly string[];
    readonly file?: string;
    readonly markdown?: string;
  }[];
}

export interface OverviewResponse {
  readonly stats: OverviewStats;
  readonly rules: RulesIndex;
}

export interface TasksResponse {
  readonly tasks: readonly MonitoringTask[];
}

export interface TaskDetailResponse {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEvent[];
}
