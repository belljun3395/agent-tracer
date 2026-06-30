import { Module, type DynamicModule } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppConfigModule } from "@monitor/server-core/config/app.config.module.js";
import { DatabaseModule } from "@monitor/server-core/database/database.module.js";
import { TypeOrmDatabaseModule } from "@monitor/server-core/database/typeorm.database.module.js";
import { buildWorkerFeatureModules } from "@monitor/server-core/feature.modules.js";
import type { ServerModuleOptions } from "@monitor/server-core/server.module.options.js";
import { IdentityModule } from "@monitor/identity-api/identity.module.js";
import { AgentQueryRunner } from "@monitor/shared/llm/agent.query.runner.js";
import { MessagesQueryRunner } from "@monitor/shared/llm/messages.query.runner.js";
import { WorkerDispatchModule } from "./dispatch.unsupported.js";
import { TitleSuggestionAgent } from "./agents/title.suggestion.agent.js";
import { RecipeScanAgent } from "./agents/recipe.scan.agent.js";
import { TaskCleanupAgent } from "./agents/task.cleanup.agent.js";
import { TitleSuggestionActivity } from "./activities/title.suggestion.activity.js";
import { RecipeScanActivity } from "./activities/recipe.scan.activity.js";
import { TaskCleanupActivity } from "./activities/task.cleanup.activity.js";

// 워커 조립 루트: 인프라 + 워커 전용 도메인 그래프 + 에이전트·액티비티를 직접 조립한다.
// 액티비티는 buildWorkerFeatureModules가 제공하는 도메인 모듈 exports에서 직접 주입받는다.
// RuleGeneration은 로컬 플러그인이 실행하므로 이 워커에 포함되지 않는다.
@Module({})
export class WorkerRootModule {
    static forRoot(options: ServerModuleOptions): DynamicModule {
        const databaseModule = DatabaseModule.forRoot(options);
        const typeOrmDatabaseModule = TypeOrmDatabaseModule.forRoot();

        return {
            module: WorkerRootModule,
            imports: [
                AppConfigModule,
                EventEmitterModule.forRoot(),
                typeOrmDatabaseModule,
                databaseModule,
                IdentityModule,
                ...buildWorkerFeatureModules(databaseModule),
                WorkerDispatchModule,
            ],
            providers: [
                {
                    provide: TitleSuggestionAgent,
                    useFactory: () => new TitleSuggestionAgent(new MessagesQueryRunner()),
                },
                {
                    provide: RecipeScanAgent,
                    useFactory: () => new RecipeScanAgent(new AgentQueryRunner()),
                },
                {
                    provide: TaskCleanupAgent,
                    useFactory: () => new TaskCleanupAgent(new MessagesQueryRunner()),
                },
                TitleSuggestionActivity,
                RecipeScanActivity,
                TaskCleanupActivity,
            ],
            exports: [
                TitleSuggestionActivity,
                RecipeScanActivity,
                TaskCleanupActivity,
            ],
        };
    }
}
