import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

// ── entities ──────────────────────────────────────────────────────────────────
import { InsightJobEntity } from "@monitor/insight-api/domain/job/insight.job.entity.js";
import { FileAffinityEntity } from "@monitor/insight-api/domain/recipe/file.affinity.entity.js";
import { RecipeApplicationEntity } from "@monitor/insight-api/domain/recipe/recipe.application.entity.js";
import { RecipeCandidateEntity } from "@monitor/insight-api/domain/recipe/recipe.candidate.entity.js";
import { RecipeEntity } from "@monitor/insight-api/domain/recipe/recipe.entity.js";
import { TaskCleanupSuggestionEntity } from "@monitor/insight-api/domain/task-cleanup/task.cleanup.suggestion.entity.js";

// ── repositories ──────────────────────────────────────────────────────────────
import { InsightJobRepository } from "@monitor/insight-api/repository/job/insight.job.repository.js";
import { FileAffinityRepository } from "@monitor/insight-api/repository/recipe/file.affinity.repository.js";
import { RecipeApplicationRepository } from "@monitor/insight-api/repository/recipe/recipe.application.repository.js";
import { RecipeCandidateRepository } from "@monitor/insight-api/repository/recipe/recipe.candidate.repository.js";
import { RecipeRepository } from "@monitor/insight-api/repository/recipe/recipe.repository.js";
import { TaskCleanupSuggestionRepository } from "@monitor/insight-api/repository/task-cleanup/task.cleanup.suggestion.repository.js";

// ── services ──────────────────────────────────────────────────────────────────
import { RecipeMatchingService } from "@monitor/insight-api/service/recipe/recipe.matching.service.js";
import { RecipeScanService } from "@monitor/insight-api/service/recipe/recipe.scan.service.js";
import { TaskCleanupService } from "@monitor/insight-api/service/task-cleanup/task.cleanup.service.js";

// ── use cases: recipe ─────────────────────────────────────────────────────────
import { AcceptRecipeCandidateUseCase } from "@monitor/insight-api/application/recipe/accept.recipe.candidate.usecase.js";
import { DismissRecipeCandidateUseCase } from "@monitor/insight-api/application/recipe/dismiss.recipe.candidate.usecase.js";
import { ListRecipeCandidatesUseCase } from "@monitor/insight-api/application/recipe/list.recipe.candidates.usecase.js";
import { ListRecipesUseCase } from "@monitor/insight-api/application/recipe/list.recipes.usecase.js";
import { RetireRecipeUseCase } from "@monitor/insight-api/application/recipe/retire.recipe.usecase.js";
import { ListRecipeApplicationsUseCase } from "@monitor/insight-api/application/recipe/list.recipe.applications.usecase.js";
import { ListFileAffinityUseCase } from "@monitor/insight-api/application/recipe/list.file.affinity.usecase.js";
import { EnqueueRecipeScanUseCase } from "@monitor/insight-api/application/recipe/enqueue.recipe.scan.usecase.js";
import { GetLatestRecipeScanUseCase } from "@monitor/insight-api/application/recipe/get.latest.recipe.scan.usecase.js";
import { MatchRecipeUseCase } from "@monitor/insight-api/application/recipe/match.recipe.usecase.js";

// ── use cases: task-cleanup ───────────────────────────────────────────────────
import { AcceptCleanupSuggestionUseCase } from "@monitor/insight-api/application/task-cleanup/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "@monitor/insight-api/application/task-cleanup/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "@monitor/insight-api/application/task-cleanup/list.cleanup.suggestions.usecase.js";
import { EnqueueTaskCleanupUseCase } from "@monitor/insight-api/application/task-cleanup/enqueue.task.cleanup.usecase.js";
import { GetLatestTaskCleanupUseCase } from "@monitor/insight-api/application/task-cleanup/get.latest.task.cleanup.usecase.js";

// ── controllers ───────────────────────────────────────────────────────────────
import { RecipeScanController } from "@monitor/insight-api/api/recipe/recipe.scan.controller.js";
import { TaskCleanupController } from "@monitor/insight-api/api/task-cleanup/task.cleanup.controller.js";

@Module({})
export class InsightModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: InsightModule,
            imports: [
                TypeOrmModule.forFeature([
                    InsightJobEntity,
                    RecipeCandidateEntity,
                    RecipeEntity,
                    RecipeApplicationEntity,
                    FileAffinityEntity,
                    TaskCleanupSuggestionEntity,
                ]),
                databaseModule,
            ],
            controllers: [RecipeScanController, TaskCleanupController],
            providers: [
                InsightJobRepository,

                // ── recipe ──
                RecipeCandidateRepository,
                RecipeRepository,
                RecipeApplicationRepository,
                FileAffinityRepository,
                RecipeScanService,
                RecipeMatchingService,
                EnqueueRecipeScanUseCase,
                GetLatestRecipeScanUseCase,
                MatchRecipeUseCase,
                ListRecipeCandidatesUseCase,
                AcceptRecipeCandidateUseCase,
                DismissRecipeCandidateUseCase,
                ListRecipesUseCase,
                RetireRecipeUseCase,
                ListRecipeApplicationsUseCase,
                ListFileAffinityUseCase,

                // ── task-cleanup ──
                TaskCleanupSuggestionRepository,
                TaskCleanupService,
                EnqueueTaskCleanupUseCase,
                GetLatestTaskCleanupUseCase,
                ListCleanupSuggestionsUseCase,
                AcceptCleanupSuggestionUseCase,
                DismissCleanupSuggestionUseCase,
            ],
            exports: [
                RecipeRepository,
                InsightJobRepository,
                RecipeCandidateRepository,
                TaskCleanupSuggestionRepository,
            ],
        };
    }
}
