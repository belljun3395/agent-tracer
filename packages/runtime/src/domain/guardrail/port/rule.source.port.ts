import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";

/** 서버가 소유한 규칙과 그 판정을 로컬 집행용으로 가져오고, 알린 사실을 되돌려준다. */
export interface RuleSourcePort {
    fetchAll(): Promise<readonly GuardrailRule[]>;
    /** 에이전트에게 미이행을 알렸음을 서버에 남겨 상한이 데몬 재기동을 넘어 살아남게 한다. */
    recordNudge(ruleId: string): Promise<void>;
}
