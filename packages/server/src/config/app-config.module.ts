import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_CONFIG_NAMESPACE, AppConfigService } from "./app-config.service.js";
import { applicationConfigSchema, loadApplicationConfig } from "./application-config.js";

/**
 * Wires the project's YAML/env config into `@nestjs/config`. The custom `load`
 * factory runs the existing loader (YAML files + env overrides + normalization)
 * and validates the result with {@link applicationConfigSchema} before it is
 * registered under the {@link APP_CONFIG_NAMESPACE} key. Global so any provider
 * can inject {@link AppConfigService} without re-importing this module.
 */
@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            load: [() => ({ [APP_CONFIG_NAMESPACE]: applicationConfigSchema.parse(loadApplicationConfig()) })],
        }),
    ],
    providers: [AppConfigService],
    exports: [AppConfigService],
})
export class AppConfigModule {}
