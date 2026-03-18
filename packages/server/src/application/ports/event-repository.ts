/**
 * @module application/ports/event-repository
 *
 * 이벤트 저장소 포트 및 검색 관련 타입.
 */

import type {
  EventClassification,
  MonitoringEventKind,
  MonitoringTask,
  TimelineEvent,
  TimelineLane
} from "@monitor/core";

export interface EventInsertInput {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId?: string;
  readonly kind: MonitoringEventKind;
  readonly lane: TimelineLane;
  readonly title: string;
  readonly body?: string;
  readonly metadata: Record<string, unknown>;
  readonly classification: EventClassification;
  readonly createdAt: string;
}

export interface SearchOptions {
  readonly taskId?: string;
  readonly limit?: number;
}

export interface SearchTaskHit {
  readonly id: string;
  readonly taskId: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly status: MonitoringTask["status"];
  readonly updatedAt: string;
}

export interface SearchEventHit {
  readonly id: string;
  readonly eventId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly title: string;
  readonly snippet?: string;
  readonly lane: TimelineLane;
  readonly kind: MonitoringEventKind;
  readonly createdAt: string;
}

export interface SearchBookmarkHit {
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

export interface SearchResults {
  readonly tasks: readonly SearchTaskHit[];
  readonly events: readonly SearchEventHit[];
  readonly bookmarks: readonly SearchBookmarkHit[];
}

export interface IEventRepository {
  insert(input: EventInsertInput): Promise<TimelineEvent>;
  findById(id: string): Promise<TimelineEvent | null>;
  findByTaskId(taskId: string): Promise<readonly TimelineEvent[]>;
  /** 태스크의 raw user.message 이벤트 수 반환 (phase 자동 도출용). */
  countRawUserMessages(taskId: string): Promise<number>;
  search(query: string, opts?: SearchOptions): Promise<SearchResults>;
}
