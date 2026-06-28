import { Injectable } from "@nestjs/common";
import { AppSettingService } from "../service/app.setting.service.js";

/** 설정 값을 저장한다. */
@Injectable()
export class SetAppSettingUseCase {
    constructor(private readonly settings: AppSettingService) {}

    async execute(input: { key: string; value: string }) {
        return { setting: await this.settings.set(input.key, input.value) };
    }
}
