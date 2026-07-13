import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { APP_SETTING_KEYS } from "@monitor/tracer-domain";
import { InMemoryAppSettingRepository } from "~tracer-api/domain/settings/port/__fakes__/in-memory.app.setting.repository.js";
import { PutSettingUseCase } from "./put.setting.usecase.js";

function makeUseCase(): PutSettingUseCase {
    return new PutSettingUseCase(new InMemoryAppSettingRepository());
}

describe("PutSettingUseCase", () => {
    it("허용 목록에 없는 키는 BadRequest로 거절한다", async () => {
        const useCase = makeUseCase();
        await expect(useCase.execute("unsupported.key", "value")).rejects.toThrow(BadRequestException);
    });

    it("값의 앞뒤 공백을 제거해 저장한다", async () => {
        const useCase = makeUseCase();
        const result = await useCase.execute(APP_SETTING_KEYS.anthropicModel, "  claude-5  ");
        expect(result.setting.maskedValue).toBe("claude-5");
    });

    it("공백뿐인 값은 저장하지 않고 거절한다", async () => {
        const useCase = makeUseCase();
        await expect(useCase.execute(APP_SETTING_KEYS.anthropicModel, "   ")).rejects.toThrow(BadRequestException);
    });

    it("민감 키는 저장 결과의 값이 마스킹되어 반환된다", async () => {
        const useCase = makeUseCase();
        const result = await useCase.execute(APP_SETTING_KEYS.anthropicApiKey, "sk-1234567890abcd");
        expect(result.setting.maskedValue).not.toBe("sk-1234567890abcd");
        expect(result.setting.maskedValue.endsWith("abcd")).toBe(true);
    });

    it("저장 결과의 hasValue는 true다", async () => {
        const useCase = makeUseCase();
        const result = await useCase.execute(APP_SETTING_KEYS.anthropicModel, "claude-5");
        expect(result.setting.hasValue).toBe(true);
    });
});
