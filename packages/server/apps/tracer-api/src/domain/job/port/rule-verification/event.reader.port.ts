import type { EventEntity } from "@monitor/tracer-domain";

export const RULE_EVENT_READER = Symbol("RuleEventReader");

/** 규칙의 판정 창과 증거를 읽는 이벤트 조회 포트다. */
export interface EventReaderPort {
    findByIds(ids: readonly string[]): Promise<EventEntity[]>;
    findByTurn(turnId: string): Promise<EventEntity[]>;
    /** 근거 입력부터 지금까지의 이벤트를 시간순으로 준다. */
    findByTaskSinceEvent(taskId: string, anchorEventId: string): Promise<EventEntity[]>;
    /** 근거 입력부터 지금까지의 창 끝(최대 seq)이며 창이 비면 null이다. */
    maxSeqSinceEvent(taskId: string, anchorEventId: string): Promise<string | null>;
}
