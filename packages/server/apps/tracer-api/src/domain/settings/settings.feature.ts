import { AppSettingRepository } from "@monitor/tracer-domain";
import { SystemClock } from "@monitor/platform";
import { DeleteSettingUseCase } from "~tracer-api/domain/settings/application/command/delete.setting.usecase.js";
import { PutSettingUseCase } from "~tracer-api/domain/settings/application/command/put.setting.usecase.js";
import { GetSettingsUseCase } from "~tracer-api/domain/settings/application/query/get.settings.usecase.js";
import { SettingsController } from "~tracer-api/domain/settings/inbound/settings.controller.js";
import { APP_SETTING_REPOSITORY } from "~tracer-api/domain/settings/port/app.setting.repository.port.js";
import { CLOCK } from "~tracer-api/domain/settings/port/clock.port.js";

/** settings 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const settingsFeature = {
    controllers: [SettingsController],
    providers: [
        DeleteSettingUseCase,
        PutSettingUseCase,
        GetSettingsUseCase,
        { provide: APP_SETTING_REPOSITORY, useExisting: AppSettingRepository },
        { provide: CLOCK, useClass: SystemClock },
    ],
};
