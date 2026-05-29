import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskCleanupController } from "./api/task.cleanup.controller.js";
import { AcceptCleanupSuggestionUseCase } from "./application/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "./application/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "./application/list.cleanup.suggestions.usecase.js";
import { TaskCleanupService } from "./application/task.cleanup.service.js";
import { TaskCleanupWorker } from "./application/task.cleanup.worker.js";
import { TaskCleanupJobEntity } from "./domain/task.cleanup.job.entity.js";
import { TaskCleanupSuggestionEntity } from "./domain/task.cleanup.suggestion.entity.js";
import { TaskCleanupJobRepository } from "./repository/task.cleanup.job.repository.js";
import { TaskCleanupSuggestionRepository } from "./repository/task.cleanup.suggestion.repository.js";

@Module({})
export class TaskCleanupModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TaskCleanupModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([
                    TaskCleanupJobEntity,
                    TaskCleanupSuggestionEntity,
                ]),
                databaseModule,
            ],
            controllers: [TaskCleanupController],
            providers: [
                TaskCleanupJobRepository,
                TaskCleanupSuggestionRepository,
                TaskCleanupService,
                TaskCleanupWorker,
                ListCleanupSuggestionsUseCase,
                AcceptCleanupSuggestionUseCase,
                DismissCleanupSuggestionUseCase,
            ],
            exports: [TaskCleanupService],
        };
    }
}
