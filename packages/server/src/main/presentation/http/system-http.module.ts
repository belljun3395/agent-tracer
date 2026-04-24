import { Module } from "@nestjs/common";
import { HealthController, SystemController } from "~adapters/http/query/index.js";
import { SystemApplicationModule } from "../application/system-application.module.js";

@Module({
    imports: [SystemApplicationModule],
    controllers: [
        HealthController,
        SystemController,
    ],
})
export class SystemHttpModule {}
