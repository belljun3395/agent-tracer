import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskCleanupController } from "./api/task.cleanup.controller.js";
import { AcceptCleanupSuggestionUseCase } from "./application/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "./application/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "./application/list.cleanup.suggestions.usecase.js";
import { EnqueueTaskCleanupUseCase } from "./application/enqueue.task.cleanup.usecase.js";
import { GetLatestTaskCleanupUseCase } from "./application/get.latest.task.cleanup.usecase.js";
import { TaskCleanupService } from "./service/task.cleanup.service.js";
import { TaskCleanupSuggestionEntity } from "./domain/task.cleanup.suggestion.entity.js";
import { TaskCleanupSuggestionRepository } from "./repository/task.cleanup.suggestion.repository.js";
import { InsightJobEntity } from "../job/insight.job.entity.js";
import { InsightJobRepository } from "../job/insight.job.repository.js";
import { TaskCleanupAgent } from "./agent/task.cleanup.agent.js";
import { MessagesQueryRunner } from "@monitor/shared/llm/messages.query.runner.js";
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
                EnqueueTaskCleanupUseCase,
                GetLatestTaskCleanupUseCase,
                ListCleanupSuggestionsUseCase,
                AcceptCleanupSuggestionUseCase,
                DismissCleanupSuggestionUseCase,

                TaskCleanupAgent,
                MessagesQueryRunner,
                { provide: QUERY_RUNNER, useExisting: MessagesQueryRunner },
            ],
            exports: [],
        };
    }
}
