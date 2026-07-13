import { describe, expect, it } from "vitest";
import { AppSettingEntity } from "./app.setting.entity.js";
import { APP_SETTING_KEYS, LLM_KEY_SETTING } from "./settings.const.js";

describe("AppSettingEntity", () => {
    describe("isLlmKey", () => {
        it("LLM 키 설정이면 true를 반환한다", () => {
            const setting = new AppSettingEntity();
            setting.key = LLM_KEY_SETTING;
            expect(setting.isLlmKey()).toBe(true);
        });

        it("다른 키면 false를 반환한다", () => {
            const setting = new AppSettingEntity();
            setting.key = APP_SETTING_KEYS.anthropicModel;
            expect(setting.isLlmKey()).toBe(false);
        });
    });

    describe("hasValue", () => {
        it("값이 있으면 true를 반환한다", () => {
            const setting = new AppSettingEntity();
            setting.value = "sk-xxx";
            expect(setting.hasValue()).toBe(true);
        });

        it("값이 빈 문자열이면 false를 반환한다", () => {
            const setting = new AppSettingEntity();
            setting.value = "";
            expect(setting.hasValue()).toBe(false);
        });
    });
});
