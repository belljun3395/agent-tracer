import type {
  EventId,
  GoalId,
  HandoffId,
  MonitoringTask,
  PlanId,
  RuntimeSessionId,
  RuntimeSource,
  TimelineEventRecord,
  WorkItemId,
} from './monitoring.js'

export interface TimelineRelation {
  readonly sourceEventId: EventId
  readonly targetEventId: EventId
  readonly relationType?: string
  readonly label?: string
  readonly explanation?: string
  readonly isExplicit: boolean
  readonly workItemId?: WorkItemId
  readonly goalId?: GoalId
  readonly planId?: PlanId
  readonly handoffId?: HandoffId
}

export interface OverviewStats {
  readonly totalTasks: number
  readonly runningTasks: number
  readonly waitingTasks: number
  readonly completedTasks: number
  readonly erroredTasks: number
  readonly totalEvents: number
}

export interface OverviewResponse {
  readonly stats: OverviewStats
}

export interface TasksResponse {
  readonly tasks: readonly MonitoringTask[]
}

export interface TaskDetailResponse {
  readonly task: MonitoringTask
  readonly timeline: readonly TimelineEventRecord[]
  readonly runtimeSessionId?: RuntimeSessionId
  readonly runtimeSource?: RuntimeSource
}
