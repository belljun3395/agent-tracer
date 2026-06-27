/**
 * 아웃바운드 포트 — 턴 구간 산출을 위해 태스크의 타임라인 이벤트를 읽는다.
 */
import type { TimelineEvent } from "~activity/event/public/types/event.types.js";

export type TimelineEventAccessRecord = TimelineEvent;

export interface ITimelineEventAccess {
    findByTaskId(taskId: string): Promise<readonly TimelineEventAccessRecord[]>;
}
