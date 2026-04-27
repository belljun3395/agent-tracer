import { Module, type DynamicModule } from "@nestjs/common";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";

// SystemQueryController moved into the task module (~task/api/system.query.controller.ts)
// since both endpoints query task-side data.
@Module({
    controllers: [
        HealthController,
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
