import type {
  EventId,
  MonitoringEventKind,
  MonitoringTask,
  TaskId,
  TimelineLane,
} from './monitoring.js'

export interface TaskSearchHit {
  readonly id: string
  readonly taskId: TaskId
  readonly title: string
  readonly workspacePath?: MonitoringTask['workspacePath']
  readonly status: MonitoringTask['status']
  readonly updatedAt: string
}

export interface EventSearchHit {
  readonly id: string
  readonly eventId: EventId
  readonly taskId: TaskId
  readonly taskTitle: string
  readonly title: string
  readonly snippet?: string
  readonly lane: TimelineLane
  readonly kind: MonitoringEventKind
  readonly createdAt: string
}

export interface SearchResponse {
  readonly tasks: readonly TaskSearchHit[]
  readonly events: readonly EventSearchHit[]
}
