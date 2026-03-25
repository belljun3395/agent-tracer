/**
 * @module application/services/task-display-title-resolver
 *
 * 태스크 표시 제목 추론 로직.
 * DB 레이어에서 분리하여 이미 로드된 task + events 배열로 동작한다.
 */

import type { MonitoringTask, TimelineEvent } from "@monitor/core";

import { deriveTaskDisplayTitle } from "./task-display-title-resolver.helpers.js";

export class TaskDisplayTitleResolver {
  resolve(task: MonitoringTask, events: readonly TimelineEvent[]): string | undefined {
    return deriveTaskDisplayTitle(task, events);
  }
}
