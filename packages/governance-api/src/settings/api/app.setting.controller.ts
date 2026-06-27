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
    AppSettingService,
    InvalidSettingValueError,
    UnsupportedSettingKeyError,
} from "../application/app.setting.service.js";
import { settingPutSchema, SettingPutDto } from "./app.setting.schema.js";

@Controller("api/v1/settings")
export class AppSettingController {
    constructor(private readonly settings: AppSettingService) {}

    @Get()
    async list() {
        return { settings: await this.settings.listMasked() };
    }

    @Put(":key")
    @HttpCode(HttpStatus.OK)
    async setKey(
        @Param("key") key: string,
        @Body(new ZodValidationPipe(settingPutSchema)) body: SettingPutDto,
    ) {
        try {
            return { setting: await this.settings.set(key, body.value) };
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
            const deleted = await this.settings.delete(key);
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
