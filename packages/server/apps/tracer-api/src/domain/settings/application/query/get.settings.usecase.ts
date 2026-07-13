import { Inject, Injectable } from "@nestjs/common";
import {
    APP_SETTING_REPOSITORY,
    type AppSettingRepositoryPort,
} from "~tracer-api/domain/settings/port/app.setting.repository.port.js";
import { maskValue, type SettingDto } from "~tracer-api/domain/settings/model/settings.model.js";

@Injectable()
export class GetSettingsUseCase {
    constructor(
        @Inject(APP_SETTING_REPOSITORY)
        private readonly settings: AppSettingRepositoryPort,
    ) {}

    async execute(): Promise<{ readonly items: readonly SettingDto[] }> {
        const entities = await this.settings.findAll();
        return {
            items: entities.map((entity) => ({
                key: entity.key,
                maskedValue: maskValue(entity.key, entity.value),
                hasValue: true,
                updatedAt: entity.updatedAt.toISOString(),
            })),
        };
    }
}
