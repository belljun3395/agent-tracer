import type { RuleEntity } from "@monitor/tracer-domain";

export const RULE_REPOSITORY = Symbol("RuleRepository");

/** 규칙 애그리게이트의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface RuleRepositoryPort {
    findById(id: string): Promise<RuleEntity | null>;
    /** 발효된 규칙만 준다. */
    findApplicable(userId: string, taskId: string): Promise<RuleEntity[]>;
    /** 승인 대기 규칙까지 준다. */
    findAllForListing(userId: string, taskId: string): Promise<RuleEntity[]>;
    findAllByUser(userId: string): Promise<RuleEntity[]>;
    /** 같은 사용자 입력에서 나온 규칙들이며 발화 하나에 규칙 여럿이 붙는다. */
    findByAnchor(userId: string, anchorEventId: string): Promise<RuleEntity[]>;
    upsert(rule: RuleEntity): Promise<void>;
}
