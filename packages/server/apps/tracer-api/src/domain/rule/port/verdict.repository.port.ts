import type { VerdictEntity } from "@monitor/tracer-domain";

export const RULE_VERDICT_REPOSITORY = Symbol("RuleVerdictRepository");

/** 규칙 판정의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface VerdictRepositoryPort {
    /** 규칙 하나에 판정 하나이므로 규칙으로 곧장 찾는다. */
    findByRule(ruleId: string): Promise<VerdictEntity | null>;
    findByRules(ruleIds: readonly string[]): Promise<VerdictEntity[]>;
    findByTurn(turnId: string): Promise<VerdictEntity[]>;
    findByTurns(turnIds: readonly string[]): Promise<VerdictEntity[]>;
    upsert(verdict: VerdictEntity): Promise<void>;
}
