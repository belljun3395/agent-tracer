import { describe, expect, it } from "vitest";
import { AppSettingEntity, APP_SETTING_KEYS } from "@monitor/tracer-domain";
import { InMemoryAppSettingRepository } from "~tracer-api/domain/settings/port/__fakes__/in-memory.app.setting.repository.js";
import { GetSettingsUseCase } from "./get.settings.usecase.js";

function makeSetting(scope: string, key: string, value: string): AppSettingEntity {
    const setting = new AppSettingEntity();
    setting.scope = scope;
    setting.key = key;
    setting.value = value;
    setting.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    return setting;
}

describe("GetSettingsUseCase", () => {
    it("설정이 없으면 빈 목록을 반환한다", async () => {
        const repo = new InMemoryAppSettingRepository();
        const useCase = new GetSettingsUseCase(repo);
        expect((await useCase.execute("local")).items).toEqual([]);
    });

    it("저장된 모든 설정을 마스킹된 값으로 반환한다", async () => {
        const repo = new InMemoryAppSettingRepository();
        repo.seed(makeSetting("local", APP_SETTING_KEYS.anthropicModel, "claude-5"));
        const useCase = new GetSettingsUseCase(repo);
        const result = await useCase.execute("local");
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ key: APP_SETTING_KEYS.anthropicModel, maskedValue: "claude-5", hasValue: true });
    });

    it("다른 scope의 설정은 섞이지 않는다", async () => {
        const repo = new InMemoryAppSettingRepository();
        repo.seed(
            makeSetting("local", APP_SETTING_KEYS.anthropicModel, "claude-local"),
            makeSetting("other", APP_SETTING_KEYS.anthropicModel, "claude-other"),
        );
        const useCase = new GetSettingsUseCase(repo);
        const result = await useCase.execute("local");
        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.maskedValue).toBe("claude-local");
    });
});
