import { Controller, Get, Inject } from "@nestjs/common";
import { GetConfigUseCase } from "~application/config/index.js";

@Controller("api/v1/config")
export class ConfigQueryController {
    constructor(
        @Inject(GetConfigUseCase) private readonly getConfig: GetConfigUseCase,
    ) {}

    // loads server configuration for the settings panel
    @Get()
    async list() {
        const config = await this.getConfig.execute();
        return { ok: true, data: { config } };
    }
}
