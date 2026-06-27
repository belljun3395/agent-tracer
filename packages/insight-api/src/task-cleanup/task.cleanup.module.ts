import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskCleanupController } from "./api/task.cleanup.controller.js";
import { AcceptCleanupSuggestionUseCase } from "./application/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "./application/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "./application/list.cleanup.suggestions.usecase.js";
import { TaskCleanupService } from "./application/task.cleanup.service.js";
import { TaskCleanupSuggestionEntity } from "./domain/task.cleanup.suggestion.entity.js";
import { TaskCleanupSuggestionRepository } from "./repository/task.cleanup.suggestion.repository.js";
import { InsightJobEntity } from "../job/insight.job.entity.js";
import { InsightJobRepository } from "../job/insight.job.repository.js";
import { TaskCleanupAgent } from "./application/task.cleanup.agent.js";
import { LocalQueryRunner } from "@monitor/shared/llm/local.query.runner.js";
import { QUERY_RUNNER } from "@monitor/shared/llm/query.runner.port.js";

@Module({})
export class TaskCleanupModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TaskCleanupModule,
            imports: [
                TypeOrmModule.forFeature([
                    InsightJobEntity,
                    TaskCleanupSuggestionEntity,
                ]),
                databaseModule,
            ],
            controllers: [TaskCleanupController],
            providers: [
                InsightJobRepository,
                TaskCleanupSuggestionRepository,
                TaskCleanupService,
                ListCleanupSuggestionsUseCase,
                AcceptCleanupSuggestionUseCase,
                DismissCleanupSuggestionUseCase,
                // 태스크 정리 LLM 에이전트 + Claude SDK 쿼리 러너
                TaskCleanupAgent,
                LocalQueryRunner,
                { provide: QUERY_RUNNER, useExisting: LocalQueryRunner },
            ],
            exports: [TaskCleanupService],
        };
    }
}
