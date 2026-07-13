import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";

/** 서버가 소유한 규칙을 로컬 판정용으로 가져온다. */
export interface RuleSourcePort {
    fetchAll(): Promise<readonly GuardrailRule[]>;
}
