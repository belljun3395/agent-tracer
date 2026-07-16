import { describe, expect, it } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AppSettingEntity, APP_SETTING_KEYS } from "@monitor/tracer-domain";
import { InMemoryAppSettingRepository } from "~tracer-api/domain/settings/port/__fakes__/in-memory.app.setting.repository.js";
import { DeleteSettingUseCase } from "./delete.setting.usecase.js";

function makeSetting(scope: string, key: string): AppSettingEntity {
    const setting = new AppSettingEntity();
    setting.scope = scope;
    setting.key = key;
    setting.value = "value";
    setting.updatedAt = new Date();
    return setting;
}

describe("DeleteSettingUseCase", () => {
    it("허용 목록에 없는 키는 BadRequest로 거절한다", async () => {
        const repo = new InMemoryAppSettingRepository();
        const useCase = new DeleteSettingUseCase(repo);
        await expect(useCase.execute("local", "unsupported.key")).rejects.toThrow(BadRequestException);
    });

    it("설정된 적 없는 키를 삭제하려 하면 NotFound를 던진다", async () => {
        const repo = new InMemoryAppSettingRepository();
        const useCase = new DeleteSettingUseCase(repo);
        await expect(useCase.execute("local", APP_SETTING_KEYS.anthropicModel)).rejects.toThrow(NotFoundException);
    });

    it("존재하는 설정을 삭제하면 deleted: true를 반환한다", async () => {
        const repo = new InMemoryAppSettingRepository();
        repo.seed(makeSetting("local", APP_SETTING_KEYS.anthropicModel));
        const useCase = new DeleteSettingUseCase(repo);
        const result = await useCase.execute("local", APP_SETTING_KEYS.anthropicModel);
        expect(result).toEqual({ deleted: true, key: APP_SETTING_KEYS.anthropicModel });
        expect(repo.all()).toHaveLength(0);
    });

    it("다른 scope의 동일 키는 지우지 못하고 NotFound를 던진다", async () => {
        const repo = new InMemoryAppSettingRepository();
        repo.seed(makeSetting("other", APP_SETTING_KEYS.anthropicModel));
        const useCase = new DeleteSettingUseCase(repo);
        await expect(useCase.execute("local", APP_SETTING_KEYS.anthropicModel)).rejects.toThrow(NotFoundException);
        expect(repo.all()).toHaveLength(1);
    });
});
