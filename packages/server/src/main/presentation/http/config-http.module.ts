import { Module, type DynamicModule } from "@nestjs/common";
import { ConfigCommandController } from "~adapters/http/command/index.js";
import { ConfigQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [ConfigCommandController, ConfigQueryController],
})
export class ConfigHttpModule {
    static register(configApplicationModule: DynamicModule): DynamicModule {
        return {
            module: ConfigHttpModule,
            imports: [configApplicationModule],
        };
    }
}
