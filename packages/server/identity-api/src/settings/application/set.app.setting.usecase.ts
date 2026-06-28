import { Injectable } from "@nestjs/common";
import { AppSettingService } from "../service/app.setting.service.js";

/** 설정 값을 저장한다(검증 에러는 service가 던지고 컨트롤러가 HTTP로 매핑). */
@Injectable()
export class SetAppSettingUseCase {
    constructor(private readonly settings: AppSettingService) {}

    async execute(input: { key: string; value: string }) {
        return { setting: await this.settings.set(input.key, input.value) };
    }
}
