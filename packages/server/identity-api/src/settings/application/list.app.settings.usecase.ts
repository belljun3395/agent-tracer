import { Injectable } from "@nestjs/common";
import { AppSettingService } from "../service/app.setting.service.js";

/** 마스킹된 설정 목록을 조회한다(컨트롤러가 service를 직접 알지 않도록). */
@Injectable()
export class ListAppSettingsUseCase {
    constructor(private readonly settings: AppSettingService) {}

    async execute() {
        return { settings: await this.settings.listMasked() };
    }
}
