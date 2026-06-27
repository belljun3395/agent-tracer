import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_CONFIG_NAMESPACE, AppConfigService } from "./app-config.service.js";
import { applicationConfigSchema, loadApplicationConfig } from "./application-config.js";

/**
 * YAML/env 설정을 @nestjs/config 로 적재한다. load 팩토리가 기존 로더(YAML+env+정규화)를
 * 실행하고 applicationConfigSchema 로 검증한 뒤 APP_CONFIG_NAMESPACE 키에 등록한다.
 * 설정은 횡단 관심사라 전역(@Global)으로 두어 모든 모듈이 AppConfigService 를 주입한다.
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
