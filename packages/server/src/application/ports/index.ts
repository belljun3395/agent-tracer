/**
 * @module application/ports
 *
 * 애플리케이션 포트(인터페이스) 모음.
 * infrastructure 레이어가 이 인터페이스를 구현하고, bootstrap에서 조합한다.
 */

export type { ITaskRepository, TaskUpsertInput, OverviewStats } from "./task-repository.js";
export type { ISessionRepository, SessionCreateInput } from "./session-repository.js";
export type {
  IEventRepository,
  EventInsertInput,
  SearchOptions,
  SearchResults,
  SearchTaskHit,
  SearchEventHit,
  SearchBookmarkHit
} from "./event-repository.js";
export type {
  IRuntimeBindingRepository,
  RuntimeBinding,
  RuntimeBindingUpsertInput
} from "./runtime-binding-repository.js";
export type {
  IBookmarkRepository,
  BookmarkRecord,
  BookmarkSaveInput
} from "./bookmark-repository.js";
export type { INotificationPublisher, MonitorNotification } from "./notification-publisher.js";

import type { ITaskRepository } from "./task-repository.js";
import type { ISessionRepository } from "./session-repository.js";
import type { IEventRepository } from "./event-repository.js";
import type { IRuntimeBindingRepository } from "./runtime-binding-repository.js";
import type { IBookmarkRepository } from "./bookmark-repository.js";
import type { INotificationPublisher } from "./notification-publisher.js";

/** 애플리케이션 서비스가 필요로 하는 모든 포트의 집합. bootstrap에서 조합한다. */
export interface MonitorPorts {
  readonly tasks: ITaskRepository;
  readonly sessions: ISessionRepository;
  readonly events: IEventRepository;
  readonly runtimeBindings: IRuntimeBindingRepository;
  readonly bookmarks: IBookmarkRepository;
  readonly notifier: INotificationPublisher;
}
