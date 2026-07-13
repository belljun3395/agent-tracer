import {RULE_GENERATION_FOCUS, type RuleGenerationFocus} from "@monitor/kernel/job/job.const.js";

/** 사람이 부른 수동 생성과 사람 검토 없이 도는 자동 트리거를 가르는 규칙 생성 모드다. */
export const RULEGEN_MODE = {
    manual: "manual",
    recent: "recent",
} as const;

export type RulegenMode = (typeof RULEGEN_MODE)[keyof typeof RULEGEN_MODE];

export function resolveRulegenMode(focus: RuleGenerationFocus | undefined): RulegenMode {
    return focus === RULE_GENERATION_FOCUS.recent ? RULEGEN_MODE.recent : RULEGEN_MODE.manual;
}

export function defaultMaxRules(mode: RulegenMode): number {
    return mode === RULEGEN_MODE.recent ? 2 : 5;
}
