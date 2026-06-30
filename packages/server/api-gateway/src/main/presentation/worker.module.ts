import { Module, type DynamicModule } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppConfigModule } from "~config/app-config.module.js";
import { IdentityModule } from "@monitor/identity-api/identity.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { TypeOrmDatabaseModule } from "./database/typeorm.database.module.js";
import { buildFeatureModules } from "./feature-modules.js";
import type { AppModuleOptions } from "./app.module.js";

// 워커 전용 합성 루트 — 도메인 그래프 + 인프라만 띄운다.
// HTTP 전달 계층(Throttler·컨트롤러·필터·인터셉터·가드·스케줄러)은 제외한다.
@Module({})
export class WorkerModule {
    static forRoot(options: AppModuleOptions): DynamicModule {
        const databaseModule = DatabaseModule.forRoot(options);
        const typeOrmDatabaseModule = TypeOrmDatabaseModule.forRoot();

        return {
            module: WorkerModule,
            imports: [
                AppConfigModule,
                EventEmitterModule.forRoot(),
                typeOrmDatabaseModule,
                databaseModule,
                IdentityModule,
                ...buildFeatureModules(databaseModule),
            ],
        };
    }
}
