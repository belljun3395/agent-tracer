import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Put } from "@nestjs/common";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { GetConfigUseCase, UpdateConfigUseCase } from "~application/config/index.js";
import { updateConfigBodySchema, type UpdateConfigBody } from "../schemas/config.schema.js";

@Controller("api/config")
export class ConfigController {
    constructor(
        @Inject(GetConfigUseCase) private readonly getConfig: GetConfigUseCase,
        @Inject(UpdateConfigUseCase) private readonly updateConfig: UpdateConfigUseCase,
    ) {}

    @Get()
    async list() {
        const config = await this.getConfig.execute();
        return { ok: true, data: { config } };
    }

    @Put()
    @HttpCode(HttpStatus.OK)
    async update(
        @Body(new ZodValidationPipe(updateConfigBodySchema)) body: UpdateConfigBody,
    ) {
        const config = await this.updateConfig.execute(body);
        return { ok: true, data: { config } };
    }
}
