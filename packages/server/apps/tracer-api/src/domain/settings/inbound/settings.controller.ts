import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from "@nestjs/common";
import { GetSettingsUseCase } from "~tracer-api/domain/settings/application/query/get.settings.usecase.js";
import { PutSettingUseCase } from "~tracer-api/domain/settings/application/command/put.setting.usecase.js";
import { DeleteSettingUseCase } from "~tracer-api/domain/settings/application/command/delete.setting.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { putSettingBodySchema, type PutSettingBody } from "./settings.put.schema.js";

@Controller("api/v1/settings")
export class SettingsController {
    constructor(
        private readonly getSettings: GetSettingsUseCase,
        private readonly putSetting: PutSettingUseCase,
        private readonly deleteSetting: DeleteSettingUseCase,
    ) {}

    @Get()
    async list() {
        return this.getSettings.execute();
    }

    @Put(":key")
    @HttpCode(HttpStatus.OK)
    async put(
        @Param("key", pathParamPipe) key: string,
        @Body(new SchemaValidationPipe(putSettingBodySchema)) body: PutSettingBody,
    ) {
        return this.putSetting.execute(key, body.value);
    }

    @Delete(":key")
    @HttpCode(HttpStatus.OK)
    async remove(@Param("key", pathParamPipe) key: string) {
        return this.deleteSetting.execute(key);
    }
}
