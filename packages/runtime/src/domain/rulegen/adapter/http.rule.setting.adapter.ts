import {APP_SETTING_KEYS, SETTING_TOGGLE} from "@monitor/kernel/settings/setting.const.js";
import {getJson} from "~runtime/config/http.js";
import {
    parseMaxRulesPerTask,
    type AutoRuleGenerationSetting,
} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

interface SettingsEnvelope {
    readonly data?: {readonly items?: readonly {readonly key: string; readonly maskedValue: string}[]};
}

/** 서버 설정 목록에서 자동 규칙 생성 항목만 뽑는다. */
export class HttpRuleSettingAdapter implements RuleSettingPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async fetchAutoRuleGeneration(): Promise<AutoRuleGenerationSetting | null> {
        const body = await getJson<SettingsEnvelope>(`${this.baseUrl}/api/v1/settings`, this.headers);
        const items = body?.data?.items;
        if (items === undefined) return null;
        const toggle = items.find((item) => item.key === APP_SETTING_KEYS.ruleGenAutoOnUserInput);
        const maxRules = items.find((item) => item.key === APP_SETTING_KEYS.ruleGenMaxRulesPerTask);
        return {
            enabled: toggle?.maskedValue === SETTING_TOGGLE.on,
            maxRulesPerTask: parseMaxRulesPerTask(maxRules?.maskedValue),
        };
    }
}
