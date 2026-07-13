import type {AutoRuleGenerationSetting} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

export class InMemoryRuleSetting implements RuleSettingPort {
    constructor(private readonly setting: AutoRuleGenerationSetting | null = null) {}

    async fetchAutoRuleGeneration(): Promise<AutoRuleGenerationSetting | null> {
        return this.setting;
    }
}
