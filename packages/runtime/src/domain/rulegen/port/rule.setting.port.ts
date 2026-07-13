import type {AutoRuleGenerationSetting} from "~runtime/domain/rulegen/model/auto.trigger.model.js";

/** 자동 규칙 생성 토글과 태스크당 규칙 상한을 서버 설정에서 읽는다. */
export interface RuleSettingPort {
    fetchAutoRuleGeneration(): Promise<AutoRuleGenerationSetting | null>;
}
