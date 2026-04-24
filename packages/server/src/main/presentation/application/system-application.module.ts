import { Module } from "@nestjs/common";
import { SYSTEM_APPLICATION_EXPORTS, SYSTEM_APPLICATION_PROVIDERS } from "./system.providers.js";

@Module({
    providers: SYSTEM_APPLICATION_PROVIDERS,
    exports: [...SYSTEM_APPLICATION_EXPORTS],
})
export class SystemApplicationModule {}
