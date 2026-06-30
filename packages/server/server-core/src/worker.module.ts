import { Module, type DynamicModule } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppConfigModule } from "./config/app.config.module.js";
import { IdentityModule } from "@monitor/identity-api/identity.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "./database/database.provider.js";
import { TypeOrmDatabaseModule } from "./database/typeorm.database.module.js";
import { buildFeatureModules } from "./feature.modules.js";
import type { ServerModuleOptions } from "./server.module.options.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import { TASK_SUMMARY, TASK_SNAPSHOT_QUERY } from "@monitor/run-api/task/public/tokens.js";
import { RuleJobRepository } from "@monitor/rules-api/job/rule.job.repository.js";
import { ListRulesUseCase } from "@monitor/rules-api/rule/application/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "@monitor/rules-api/rule/application/register.suggestion.usecase.js";
import { InsightJobRepository } from "@monitor/insight-api/job/insight.job.repository.js";
import { RecipeCandidateRepository } from "@monitor/insight-api/recipe/repository/recipe.candidate.repository.js";
import { RecipeRepository } from "@monitor/insight-api/recipe/repository/recipe.repository.js";
import { TaskCleanupSuggestionRepository } from "@monitor/insight-api/task-cleanup/repository/task.cleanup.suggestion.repository.js";

// 워커 전용 합성 루트 — 도메인 그래프 + 인프라만 띄운다.
// HTTP 전달 계층(Throttler·컨트롤러·필터·인터셉터·가드·스케줄러)은 제외한다.
@Module({})
export class WorkerModule {
    static forRoot(options: ServerModuleOptions): DynamicModule {
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
            exports: [
                NOTIFICATION_PUBLISHER_TOKEN,
                APP_SETTINGS,
                TASK_SUMMARY,
                TASK_SNAPSHOT_QUERY,
                RuleJobRepository,
                ListRulesUseCase,
                RegisterSuggestionUseCase,
                InsightJobRepository,
                RecipeCandidateRepository,
                RecipeRepository,
                TaskCleanupSuggestionRepository,
            ],
        };
    }
}
