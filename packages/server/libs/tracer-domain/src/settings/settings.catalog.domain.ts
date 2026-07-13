import type { AppSettingEntity } from "./app.setting.entity.js";

/** 여러 설정 값을 모아 자격 증명 유무를 판단한다. */
export class SettingsCatalog {
    constructor(private readonly settings: readonly AppSettingEntity[]) {}

    llmKeyPresent(key?: string): boolean {
        return this.settings.some((setting) =>
            (key !== undefined ? setting.key === key : setting.isLlmKey())
            && setting.hasValue(),
        );
    }
}
