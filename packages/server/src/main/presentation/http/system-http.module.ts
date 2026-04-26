import { Module, type DynamicModule } from "@nestjs/common";
import { HealthController, SystemQueryController } from "~adapters/http/query/index.js";

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
