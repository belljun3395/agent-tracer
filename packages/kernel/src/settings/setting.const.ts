// 저장과 입력 표면과 소비자가 같은 값을 써야 하는 앱 설정 키의 단일 소유 지점이다.
export const APP_SETTING_KEYS = {
    anthropicApiKey: "anthropic.api_key",
    anthropicModel: "anthropic.model",
    ruleGenMaxRulesPerTask: "ruleGen.maxRulesPerTask",
    ruleGenAutoOnUserInput: "ruleGen.autoOnUserInput",
    taskCleanupMaxSuggestions: "taskCleanup.maxSuggestions",
    claudeOutputLanguage: "claude.outputLanguage",
} as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS];

/** 토글 설정의 저장 값이며 데몬은 on일 때만 자동 규칙 생성을 돈다. */
export const SETTING_TOGGLE = {
    on: "on",
    off: "off",
} as const;

export type SettingToggle = (typeof SETTING_TOGGLE)[keyof typeof SETTING_TOGGLE];

export const SUPPORTED_SETTING_KEYS: ReadonlySet<string> = new Set(Object.values(APP_SETTING_KEYS));

export function isSettingKeySupported(key: string): boolean {
    return SUPPORTED_SETTING_KEYS.has(key);
}
