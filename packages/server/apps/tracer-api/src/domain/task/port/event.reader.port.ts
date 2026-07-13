import type { EventEntity } from "@monitor/tracer-domain";

export const EVENT_READER = Symbol("EventReader");

/** 태스크 타임라인 이벤트 조회를 제공하는 애플리케이션 포트다. */
export interface EventReaderPort {
    findTimeline(taskId: string, cursor: { seq: string } | undefined, limit: number): Promise<EventEntity[]>;
    findUserMessagesByTask(taskId: string): Promise<EventEntity[]>;
}
