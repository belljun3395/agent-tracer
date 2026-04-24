import { Module, type DynamicModule } from "@nestjs/common";
import { HealthController, SystemController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        HealthController,
        SystemController,
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
