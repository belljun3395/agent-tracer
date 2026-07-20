import {APP_SETTING_KEYS} from "@monitor/kernel/settings/setting.const.js";
import {getJson} from "~runtime/config/http.js";
import {parseMaxRulesPerTask} from "~runtime/domain/rulegen/model/rule.command.model.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

interface SettingsEnvelope {
    readonly data?: {readonly items?: readonly {readonly key: string; readonly maskedValue: string}[]};
}

/** 서버 설정 목록에서 규칙 생성 상한만 뽑는다. */
export class HttpRuleSettingAdapter implements RuleSettingPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async fetchMaxRulesPerTask(): Promise<number | null> {
        const fetched = await getJson<SettingsEnvelope>(`${this.baseUrl}/api/v1/settings`, this.headers);
        const items = fetched.kind === "found" ? fetched.value.data?.items : undefined;
        if (items === undefined) return null;
        const maxRules = items.find((item) => item.key === APP_SETTING_KEYS.ruleGenMaxRulesPerTask);
        return parseMaxRulesPerTask(maxRules?.maskedValue);
    }
}
