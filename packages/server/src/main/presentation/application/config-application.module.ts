import { Module, type DynamicModule } from "@nestjs/common";
import {
    CONFIG_APPLICATION_EXPORTS,
    CONFIG_APPLICATION_PROVIDERS,
} from "./config.providers.js";

@Module({
    providers: CONFIG_APPLICATION_PROVIDERS,
    exports: [...CONFIG_APPLICATION_EXPORTS],
})
export class ConfigApplicationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: ConfigApplicationModule,
            imports: [databaseModule],
        };
    }
}
