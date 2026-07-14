import {isEnforceableReviewState} from "@monitor/kernel/rule/definition/rule.review.js";
import type {RuleExpectation} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import type {VerdictStatus} from "@monitor/kernel/rule/evaluation/rule.verdict.js";

/** 로컬 판정에 쓰는 서버 규칙의 정규화 형태다. */
export interface GuardrailRule {
    readonly id: string;
    readonly name: string;
    readonly severity: string;
    readonly taskId: string;
    readonly reviewState: string;
    readonly expectation: RuleExpectation;
    /** 규칙을 낳은 사용자 입력이며 판정 창이 여기서 시작한다. */
    readonly anchorEventId: string;
    /** 서버가 확정한 판정 상태이며 아직 열리지 않았으면 null이다. */
    readonly verdictStatus: VerdictStatus | null;
    /** 상한만큼 알렸는데도 이행되지 않아 더는 막지 않는 판정이다. */
    readonly escalated: boolean;
}

/** 승인됐고 이 태스크에 속한 규칙만 집행한다. */
export function isEnforceableRule(rule: GuardrailRule, taskId: string): boolean {
    if (!isEnforceableReviewState(rule.reviewState)) return false;
    return rule.taskId === taskId;
}
