import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskCleanupController } from "./api/task.cleanup.controller.js";
import { AcceptCleanupSuggestionUseCase } from "./application/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "./application/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "./application/list.cleanup.suggestions.usecase.js";
import { TaskCleanupService } from "./application/task.cleanup.service.js";
import { TaskCleanupSuggestionEntity } from "./domain/task.cleanup.suggestion.entity.js";
import { TaskCleanupSuggestionRepository } from "./repository/task.cleanup.suggestion.repository.js";
import { GovernanceJobEntity } from "~governance/job/governance.job.entity.js";
import { GovernanceJobRepository } from "~governance/job/governance.job.repository.js";

@Module({})
export class TaskCleanupModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TaskCleanupModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([
                    GovernanceJobEntity,
                    TaskCleanupSuggestionEntity,
                ]),
                databaseModule,
            ],
            controllers: [TaskCleanupController],
            providers: [
                GovernanceJobRepository,
                TaskCleanupSuggestionRepository,
                TaskCleanupService,
                ListCleanupSuggestionsUseCase,
                AcceptCleanupSuggestionUseCase,
                DismissCleanupSuggestionUseCase,
            ],
            exports: [TaskCleanupService],
        };
    }
}
