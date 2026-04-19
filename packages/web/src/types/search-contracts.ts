import type {
  BookmarkId,
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

export interface BookmarkSearchHit {
  readonly id: string
  readonly bookmarkId: BookmarkId
  readonly taskId: TaskId
  readonly eventId?: EventId
  readonly kind: 'task' | 'event'
  readonly title: string
  readonly note?: string
  readonly taskTitle?: string
  readonly eventTitle?: string
  readonly createdAt: string
}

export interface SearchResponse {
  readonly tasks: readonly TaskSearchHit[]
  readonly events: readonly EventSearchHit[]
  readonly bookmarks: readonly BookmarkSearchHit[]
}
