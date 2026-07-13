import type {
    AutoRuleGenerationSetting,
    AutoTriggerSettingCache,
} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

/** 서버 설정을 읽어 자동 규칙 생성 캐시를 갱신하고 읽지 못하면 직전 값을 지킨다. */
export class RefreshAutoTriggerUsecase {
    constructor(
        private readonly settings: RuleSettingPort,
        private readonly cache: AutoTriggerSettingCache,
    ) {}

    async execute(): Promise<AutoRuleGenerationSetting> {
        try {
            const setting = await this.settings.fetchAutoRuleGeneration();
            if (setting !== null) this.cache.replace(setting);
        } catch {
            return this.cache.snapshot();
        }
        return this.cache.snapshot();
    }
}
