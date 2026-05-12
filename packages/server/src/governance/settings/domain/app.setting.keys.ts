export const APP_SETTING_KEYS = {
    anthropicApiKey: "anthropic.api_key",
    anthropicModel: "anthropic.model",
    ruleGenMaxRulesPerTask: "ruleGen.maxRulesPerTask",
    taskCleanupMaxSuggestions: "taskCleanup.maxSuggestions",
} as const;

export const SENSITIVE_SETTING_KEYS: ReadonlySet<string> = new Set([
    APP_SETTING_KEYS.anthropicApiKey,
]);

export const SUPPORTED_SETTING_KEYS: ReadonlySet<string> = new Set(
    Object.values(APP_SETTING_KEYS),
);

const MASK_DOT_COUNT = 8;

export function maskSensitiveValue(key: string, value: string): string {
    if (!SENSITIVE_SETTING_KEYS.has(key)) return value;
    if (value.length <= 4) return "•".repeat(value.length);
    return "•".repeat(MASK_DOT_COUNT) + value.slice(-4);
}

export function isSettingKeySupported(key: string): boolean {
    return SUPPORTED_SETTING_KEYS.has(key);
}
