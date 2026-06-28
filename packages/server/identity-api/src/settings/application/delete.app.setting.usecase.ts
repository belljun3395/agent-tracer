import { Injectable } from "@nestjs/common";
import { AppSettingService } from "../service/app.setting.service.js";

/** 설정 값을 삭제한다. 미존재(false) 매핑은 컨트롤러가 HTTP로 처리한다. */
@Injectable()
export class DeleteAppSettingUseCase {
    constructor(private readonly settings: AppSettingService) {}

    async execute(key: string): Promise<boolean> {
        return this.settings.delete(key);
    }
}
