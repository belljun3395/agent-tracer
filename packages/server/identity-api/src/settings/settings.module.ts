import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSettingController } from "./api/app.setting.controller.js";
import { AppSettingService } from "./application/app.setting.service.js";
import { AppSettingEntity } from "./domain/app.setting.entity.js";
import { AppSettingRepository } from "./repository/app.setting.repository.js";
import { APP_SETTINGS } from "./public/tokens.js";

@Module({})
export class SettingsModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: SettingsModule,
            imports: [TypeOrmModule.forFeature([AppSettingEntity]), databaseModule],
            controllers: [AppSettingController],
            providers: [
                AppSettingRepository,
                AppSettingService,
                { provide: APP_SETTINGS, useExisting: AppSettingService },
            ],
            exports: [APP_SETTINGS],
        };
    }
}
