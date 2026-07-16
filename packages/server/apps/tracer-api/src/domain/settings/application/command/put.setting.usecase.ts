import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AppSettingEntity, isSettingKeySupported } from "@monitor/tracer-domain";
import {
    APP_SETTING_REPOSITORY,
    type AppSettingRepositoryPort,
} from "~tracer-api/domain/settings/port/app.setting.repository.port.js";
import { CLOCK, type ClockPort } from "~tracer-api/domain/settings/port/clock.port.js";
import { maskValue, type SettingDto } from "~tracer-api/domain/settings/model/settings.model.js";

@Injectable()
export class PutSettingUseCase {
    constructor(
        @Inject(APP_SETTING_REPOSITORY)
        private readonly settings: AppSettingRepositoryPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(scope: string, key: string, value: string): Promise<{ readonly setting: SettingDto }> {
        if (!isSettingKeySupported(key)) throw new BadRequestException(`Unsupported setting key: ${key}`);
        const trimmed = value.trim();
        if (trimmed.length === 0) throw new BadRequestException("Setting value must not be empty");

        const now = this.clock.now();
        const entity = new AppSettingEntity();
        entity.scope = scope;
        entity.key = key;
        entity.value = trimmed;
        entity.updatedAt = now;
        await this.settings.upsert(entity);

        return {
            setting: { key, maskedValue: maskValue(key, trimmed), hasValue: true, updatedAt: now.toISOString() },
        };
    }
}
