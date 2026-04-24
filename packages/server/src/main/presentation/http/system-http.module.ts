import { Module } from "@nestjs/common";
import { HealthController, SystemController } from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        HealthController,
        SystemController,
    ],
})
export class SystemHttpModule {}
