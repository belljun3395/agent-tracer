import { APP_SETTING_KEYS } from "@monitor/kernel";

export { APP_SETTING_KEYS, SUPPORTED_SETTING_KEYS, isSettingKeySupported } from "@monitor/kernel";
export type { AppSettingKey } from "@monitor/kernel";

export const LLM_KEY_SETTING = APP_SETTING_KEYS.anthropicApiKey;

export const LLM_KEY_SETTINGS: ReadonlySet<string> = new Set([
    APP_SETTING_KEYS.anthropicApiKey,
]);

/** 저장 시 암호화되는 민감 설정 키다. */
export const SENSITIVE_SETTING_KEYS: ReadonlySet<string> = new Set(LLM_KEY_SETTINGS);

export function isSensitiveSettingKey(key: string): boolean {
    return SENSITIVE_SETTING_KEYS.has(key);
}

export function isLlmKeySettingKey(key: string): boolean {
    return LLM_KEY_SETTINGS.has(key);
}
