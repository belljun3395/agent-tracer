import { describe, expect, it } from "vitest";
import { APP_SETTING_KEYS, isSensitiveSettingKey, isSettingKeySupported } from "./settings.const.js";

describe("isSensitiveSettingKey", () => {
    it("anthropic API 키는 민감 키다", () => {
        expect(isSensitiveSettingKey(APP_SETTING_KEYS.anthropicApiKey)).toBe(true);
    });


    it("모델 설정 같은 비민감 키는 false를 반환한다", () => {
        expect(isSensitiveSettingKey(APP_SETTING_KEYS.anthropicModel)).toBe(false);
    });
});

describe("isSettingKeySupported", () => {
    it("허용 목록에 있는 키는 true를 반환한다", () => {
        expect(isSettingKeySupported(APP_SETTING_KEYS.claudeOutputLanguage)).toBe(true);
    });

    it("자동 규칙 생성 토글 키는 허용 목록에 있다", () => {
        expect(isSettingKeySupported(APP_SETTING_KEYS.ruleGenAutoOnUserInput)).toBe(true);
    });


    it("자동 규칙 생성 토글 키는 비민감 키다", () => {
        expect(isSensitiveSettingKey(APP_SETTING_KEYS.ruleGenAutoOnUserInput)).toBe(false);
    });

    it("허용 목록 밖의 키는 false를 반환한다", () => {
        expect(isSettingKeySupported("unknown.key")).toBe(false);
    });
});
