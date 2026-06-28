import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Put,
} from "@nestjs/common";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import {
    InvalidSettingValueError,
    UnsupportedSettingKeyError,
} from "../service/app.setting.service.js";
import { ListAppSettingsUseCase } from "../application/list.app.settings.usecase.js";
import { SetAppSettingUseCase } from "../application/set.app.setting.usecase.js";
import { DeleteAppSettingUseCase } from "../application/delete.app.setting.usecase.js";
import { settingPutSchema, SettingPutDto } from "./app.setting.schema.js";

@Controller("api/v1/settings")
export class AppSettingController {
    constructor(
        private readonly listSettings: ListAppSettingsUseCase,
        private readonly setSetting: SetAppSettingUseCase,
        private readonly deleteSetting: DeleteAppSettingUseCase,
    ) {}

    @Get()
    async list() {
        return this.listSettings.execute();
    }

    @Put(":key")
    @HttpCode(HttpStatus.OK)
    async setKey(
        @Param("key") key: string,
        @Body(new ZodValidationPipe(settingPutSchema)) body: SettingPutDto,
    ) {
        try {
            return await this.setSetting.execute({ key, value: body.value });
        } catch (err) {
            if (err instanceof UnsupportedSettingKeyError) {
                throw new BadRequestException(err.message);
            }
            if (err instanceof InvalidSettingValueError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }

    @Delete(":key")
    @HttpCode(HttpStatus.OK)
    async deleteKey(@Param("key") key: string) {
        try {
            const deleted = await this.deleteSetting.execute(key);
            if (!deleted) throw new NotFoundException(`Setting not set: ${key}`);
            return { deleted: true, key };
        } catch (err) {
            if (err instanceof UnsupportedSettingKeyError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }
}
