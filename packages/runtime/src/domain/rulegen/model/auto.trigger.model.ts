import {KIND} from "@monitor/kernel/ingest/event.kind.const.js";

export const AUTO_RULE_GENERATION_MAX_RULES = 2;
const MAX_RULES_LIMIT = 20;

// 터미널에서 규칙 생성을 부르는 두 표면이며 플러그인 네임스페이스 접두사도 같은 명령으로 본다.
const RULE_COMMAND = /^(?:\/(?:[\w-]+:)?rule|\$rule)(?:\s|$)/i;

/** 데몬이 주기적으로 갱신하는 자동 규칙 생성 설정이다. */
export interface AutoRuleGenerationSetting {
    readonly enabled: boolean;
    readonly maxRulesPerTask: number;
}

export const AUTO_RULE_GENERATION_DISABLED: AutoRuleGenerationSetting = {
    enabled: false,
    maxRulesPerTask: AUTO_RULE_GENERATION_MAX_RULES,
};

export function parseMaxRulesPerTask(raw: string | undefined): number {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) return AUTO_RULE_GENERATION_MAX_RULES;
    return Math.min(parsed, MAX_RULES_LIMIT);
}

export function hasRuleCommand(prompt: string): boolean {
    return RULE_COMMAND.test(prompt.trimStart());
}

/** 사용자 입력 하나가 자동 규칙 생성을 부를 자격이 있는지 본다. */
export function isAutoRuleGenerationTrigger(
    setting: AutoRuleGenerationSetting,
    kind: string,
    taskId: string,
    eventId: string,
    prompt: string,
): boolean {
    if (!setting.enabled) return false;
    if (kind !== KIND.userMessage) return false;
    if (taskId.length === 0 || eventId.length === 0) return false;
    return hasRuleCommand(prompt);
}

/** 갱신 주기 사이에 두 유스케이스가 함께 보는 설정 캐시다. */
export class AutoTriggerSettingCache {
    private current: AutoRuleGenerationSetting = AUTO_RULE_GENERATION_DISABLED;

    snapshot(): AutoRuleGenerationSetting {
        return this.current;
    }

    replace(setting: AutoRuleGenerationSetting): void {
        this.current = setting;
    }
}
