import type {RuleGenerationSettingCache} from "~runtime/domain/rulegen/model/rule.command.model.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

/** 서버 설정을 읽어 규칙 상한 캐시를 갱신하고 읽지 못하면 직전 값을 지킨다. */
export class RefreshRuleSettingUsecase {
    constructor(
        private readonly settings: RuleSettingPort,
        private readonly cache: RuleGenerationSettingCache,
    ) {}

    async execute(): Promise<number> {
        try {
            const maxRulesPerTask = await this.settings.fetchMaxRulesPerTask();
            if (maxRulesPerTask !== null) this.cache.replace(maxRulesPerTask);
        } catch {
            return this.cache.snapshot();
        }
        return this.cache.snapshot();
    }
}
