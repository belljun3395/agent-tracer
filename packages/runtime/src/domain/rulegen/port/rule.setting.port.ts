/** 태스크당 규칙 상한을 서버 설정에서 읽는다. */
export interface RuleSettingPort {
    fetchMaxRulesPerTask(): Promise<number | null>;
}
