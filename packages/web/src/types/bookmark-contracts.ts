import type { BookmarkId, EventId, TaskId } from './monitoring.js'

export interface BookmarkRecord {
  readonly id: BookmarkId
  readonly kind: 'task' | 'event'
  readonly taskId: TaskId
  readonly eventId?: EventId
  readonly title: string
  readonly note?: string
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
  readonly taskTitle?: string
  readonly eventTitle?: string
}

export interface BookmarksResponse {
  readonly bookmarks: readonly BookmarkRecord[]
}
