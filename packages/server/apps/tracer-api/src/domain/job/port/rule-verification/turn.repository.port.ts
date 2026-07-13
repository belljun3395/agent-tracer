import type { TurnEntity } from "@monitor/tracer-domain";

export const RULE_TURN_REPOSITORY = Symbol("RuleTurnRepository");

/** 규칙 판정이 읽고 판정 요약을 기록하는 턴 저장소 포트다. */
export interface TurnRepositoryPort {
    findById(id: string): Promise<TurnEntity | null>;
    findByTask(taskId: string): Promise<TurnEntity[]>;
    upsert(turn: TurnEntity): Promise<void>;
}
