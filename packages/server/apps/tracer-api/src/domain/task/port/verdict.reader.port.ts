import type { VerdictEntity } from "@monitor/tracer-domain";

export const VERDICT_READER = Symbol("VerdictReader");

/** 턴에 기록된 규칙 판정 조회를 제공하는 애플리케이션 포트다. */
export interface VerdictReaderPort {
    findByTurn(turnId: string): Promise<VerdictEntity[]>;
}
