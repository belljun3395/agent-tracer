export const APP_SETTING_KEYS = {
    anthropicApiKey: "anthropic.api_key",
    anthropicModel: "anthropic.model",
    ruleGenMaxRulesPerTask: "ruleGen.maxRulesPerTask",
    taskCleanupMaxSuggestions: "taskCleanup.maxSuggestions",

    claudeOutputLanguage: "claude.outputLanguage",
} as const;

export const SENSITIVE_SETTING_KEYS: ReadonlySet<string> = new Set([
    APP_SETTING_KEYS.anthropicApiKey,
]);

export const SUPPORTED_SETTING_KEYS: ReadonlySet<string> = new Set(
    Object.values(APP_SETTING_KEYS),
);

const MASK_DOT_COUNT = 8;

export function maskSensitiveValue(key: string, value: string): string {
    // 민감하지 않은 설정은 UI에서 원문을 보여준다.
    if (!SENSITIVE_SETTING_KEYS.has(key)) return value;
    // 짧은 비밀값은 길이만 드러나도록 전체를 마스킹한다.
    if (value.length <= 4) return "•".repeat(value.length);
    return "•".repeat(MASK_DOT_COUNT) + value.slice(-4);
}

export function isSettingKeySupported(key: string): boolean {
    return SUPPORTED_SETTING_KEYS.has(key);
}
