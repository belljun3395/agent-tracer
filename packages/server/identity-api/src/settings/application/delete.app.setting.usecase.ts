import { Injectable } from "@nestjs/common";
import { AppSettingService } from "../service/app.setting.service.js";

/** 설정 값을 삭제한다. */
@Injectable()
export class DeleteAppSettingUseCase {
    constructor(private readonly settings: AppSettingService) {}

    async execute(key: string): Promise<boolean> {
        return this.settings.delete(key);
    }
}
