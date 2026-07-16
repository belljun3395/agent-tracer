import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Put } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { GetSettingsUseCase } from "~tracer-api/domain/settings/application/query/get.settings.usecase.js";
import { PutSettingUseCase } from "~tracer-api/domain/settings/application/command/put.setting.usecase.js";
import { DeleteSettingUseCase } from "~tracer-api/domain/settings/application/command/delete.setting.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { putSettingBodySchema, type PutSettingBody } from "./settings.put.schema.js";

@Controller("api/v1/settings")
export class SettingsController {
    constructor(
        private readonly getSettings: GetSettingsUseCase,
        private readonly putSetting: PutSettingUseCase,
        private readonly deleteSetting: DeleteSettingUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.getSettings.execute(resolveUserId(user));
    }

    @Put(":key")
    @HttpCode(HttpStatus.OK)
    async put(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("key", pathParamPipe) key: string,
        @Body(new SchemaValidationPipe(putSettingBodySchema)) body: PutSettingBody,
    ) {
        return this.putSetting.execute(resolveUserId(user), key, body.value);
    }

    @Delete(":key")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("key", pathParamPipe) key: string,
    ) {
        return this.deleteSetting.execute(resolveUserId(user), key);
    }
}
