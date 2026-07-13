import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { isSettingKeySupported } from "@monitor/tracer-domain";
import {
    APP_SETTING_REPOSITORY,
    type AppSettingRepositoryPort,
} from "~tracer-api/domain/settings/port/app.setting.repository.port.js";

@Injectable()
export class DeleteSettingUseCase {
    constructor(
        @Inject(APP_SETTING_REPOSITORY)
        private readonly settings: AppSettingRepositoryPort,
    ) {}

    async execute(key: string): Promise<{ readonly deleted: true; readonly key: string }> {
        if (!isSettingKeySupported(key)) throw new BadRequestException(`Unsupported setting key: ${key}`);
        const deleted = await this.settings.delete(key);
        if (!deleted) throw new NotFoundException(`Setting not set: ${key}`);
        return { deleted: true, key };
    }
}
