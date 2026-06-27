import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_CONFIG_NAMESPACE, AppConfigService } from "./app-config.service.js";
import { applicationConfigSchema, loadApplicationConfig } from "./application-config.js";

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
