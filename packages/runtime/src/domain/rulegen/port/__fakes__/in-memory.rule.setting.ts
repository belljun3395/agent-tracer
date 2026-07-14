import type {RuleSettingPort} from "~runtime/domain/rulegen/port/rule.setting.port.js";

/** 규칙 생성 설정 포트의 인메모리 대역이다. */
export class InMemoryRuleSetting implements RuleSettingPort {
    constructor(private readonly maxRulesPerTask: number | null = null) {}

    async fetchMaxRulesPerTask(): Promise<number | null> {
        return this.maxRulesPerTask;
    }
}
