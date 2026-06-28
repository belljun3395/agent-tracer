import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSettingController } from "./api/app.setting.controller.js";
import { AppSettingService } from "./service/app.setting.service.js";
import { AppSettingEntity } from "./domain/app.setting.entity.js";
import { AppSettingRepository } from "./repository/app.setting.repository.js";
import { ListAppSettingsUseCase } from "./application/list.app.settings.usecase.js";
import { SetAppSettingUseCase } from "./application/set.app.setting.usecase.js";
import { DeleteAppSettingUseCase } from "./application/delete.app.setting.usecase.js";
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
                ListAppSettingsUseCase,
                SetAppSettingUseCase,
                DeleteAppSettingUseCase,
                { provide: APP_SETTINGS, useExisting: AppSettingService },
            ],
            exports: [APP_SETTINGS],
        };
    }
}
