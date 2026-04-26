import { Module, type DynamicModule } from "@nestjs/common";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { SystemQueryController } from "~adapters/http/query/controllers/system/system.query.controller.js";

@Module({
    controllers: [
        HealthController,
        SystemQueryController,
    ],
})
export class SystemHttpModule {
    static register(systemApplicationModule: DynamicModule): DynamicModule {
        return {
            module: SystemHttpModule,
            imports: [systemApplicationModule],
        };
    }
}
