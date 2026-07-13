import {isEnforceableReviewState} from "@monitor/kernel/rule/definition/rule.review.js";
import {RULE_SCOPE, type RuleExpectation, type RuleTrigger} from "@monitor/kernel/rule/definition/rule.vocabulary.js";

/** 로컬 판정에 쓰는 서버 규칙의 정규화 형태다. */
export interface GuardrailRule {
    readonly name: string;
    readonly severity: string;
    readonly scope: string;
    readonly taskId: string | null;
    readonly reviewState: string;
    readonly trigger: RuleTrigger;
    readonly expectation: RuleExpectation;
    /** 규칙의 근거가 된 사용자 입력이다. */
    readonly anchorEventId: string | null;
}

/** 승인됐고 이 태스크에 적용되는 규칙만 집행한다. */
export function isEnforceableRule(rule: GuardrailRule, taskId: string): boolean {
    if (!isEnforceableReviewState(rule.reviewState)) return false;
    return rule.scope === RULE_SCOPE.global || rule.taskId === taskId;
}
