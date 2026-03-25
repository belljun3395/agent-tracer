/**
 * @module application/ports/notification-publisher
 *
 * 실시간 알림 발행 포트.
 * WebSocket, SSE 등 구체적 전송 방식과 분리된 인터페이스.
 */

import type {
  MonitoringTask,
  MonitoringSession,
  TimelineEvent
} from "@monitor/core";

import type { BookmarkRecord } from "./bookmark-repository.js";

export type MonitorNotification =
  | { readonly type: "task.started";   readonly payload: MonitoringTask }
  | { readonly type: "task.completed"; readonly payload: MonitoringTask }
  | { readonly type: "task.updated";   readonly payload: MonitoringTask }
  | { readonly type: "task.deleted";   readonly payload: { taskId: string } }
  | { readonly type: "session.started"; readonly payload: MonitoringSession }
  | { readonly type: "session.ended";  readonly payload: MonitoringSession }
  | { readonly type: "event.logged";   readonly payload: TimelineEvent }
  | { readonly type: "event.updated";  readonly payload: TimelineEvent }
  | { readonly type: "bookmark.saved"; readonly payload: BookmarkRecord }
  | { readonly type: "bookmark.deleted"; readonly payload: { bookmarkId: string } }
  | { readonly type: "tasks.purged";   readonly payload: { count: number } };

export interface INotificationPublisher {
  publish(notification: MonitorNotification): void;
}
