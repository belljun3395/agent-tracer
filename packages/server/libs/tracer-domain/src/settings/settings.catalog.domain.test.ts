import { describe, expect, it } from "vitest";
import { AppSettingEntity } from "./app.setting.entity.js";
import { SettingsCatalog } from "./settings.catalog.domain.js";
import { APP_SETTING_KEYS } from "./settings.const.js";

function makeSetting(key: string, value: string): AppSettingEntity {
    const setting = new AppSettingEntity();
    setting.key = key;
    setting.value = value;
    setting.updatedAt = new Date();
    return setting;
}

describe("SettingsCatalog", () => {
    describe("llmKeyPresent", () => {
        it("값이 채워진 LLM 키가 있으면 true를 반환한다", () => {
            const catalog = new SettingsCatalog([makeSetting(APP_SETTING_KEYS.anthropicApiKey, "sk-xxx")]);
            expect(catalog.llmKeyPresent()).toBe(true);
        });


        it("LLM 키의 값이 비어 있으면 false를 반환한다", () => {
            const catalog = new SettingsCatalog([makeSetting(APP_SETTING_KEYS.anthropicApiKey, "")]);
            expect(catalog.llmKeyPresent()).toBe(false);
        });

        it("LLM 키 자체가 없으면 false를 반환한다", () => {
            const catalog = new SettingsCatalog([makeSetting(APP_SETTING_KEYS.anthropicModel, "claude")]);
            expect(catalog.llmKeyPresent()).toBe(false);
        });

    });
});
