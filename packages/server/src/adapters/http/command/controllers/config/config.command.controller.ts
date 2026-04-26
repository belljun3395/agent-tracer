import { Body, Controller, HttpCode, HttpStatus, Inject, Put } from "@nestjs/common";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { UpdateConfigUseCase } from "~application/config/index.js";
import { updateConfigBodySchema, type UpdateConfigBody } from "~adapters/http/query/schemas/config.schema.js";

@Controller("api/v1/config")
export class ConfigCommandController {
    constructor(
        @Inject(UpdateConfigUseCase) private readonly updateConfig: UpdateConfigUseCase,
    ) {}

    // saves configuration changes from the settings panel
    @Put()
    @HttpCode(HttpStatus.OK)
    async update(
        @Body(new ZodValidationPipe(updateConfigBodySchema)) body: UpdateConfigBody,
    ) {
        const config = await this.updateConfig.execute(body);
        return { ok: true, data: { config } };
    }
}
