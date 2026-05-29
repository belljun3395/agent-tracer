import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecipeScanController } from "./api/recipe.scan.controller.js";
import { AcceptRecipeCandidateUseCase } from "./application/accept.recipe.candidate.usecase.js";
import { DismissRecipeCandidateUseCase } from "./application/dismiss.recipe.candidate.usecase.js";
import { ListRecipeCandidatesUseCase } from "./application/list.recipe.candidates.usecase.js";
import { ListRecipesUseCase } from "./application/list.recipes.usecase.js";
import { RecipeMatchingService } from "./application/recipe.matching.service.js";
import { RecipeScanService } from "./application/recipe.scan.service.js";
import { RecipeScanWorker } from "./application/recipe.scan.worker.js";
import { RetireRecipeUseCase } from "./application/retire.recipe.usecase.js";
import { FileAffinityEntity } from "./domain/file.affinity.entity.js";
import { RecipeApplicationEntity } from "./domain/recipe.application.entity.js";
import { RecipeCandidateEntity } from "./domain/recipe.candidate.entity.js";
import { RecipeEntity } from "./domain/recipe.entity.js";
import { RecipeScanJobEntity } from "./domain/recipe.scan.job.entity.js";
import { FileAffinityRepository } from "./repository/file.affinity.repository.js";
import { RecipeApplicationRepository } from "./repository/recipe.application.repository.js";
import { RecipeCandidateRepository } from "./repository/recipe.candidate.repository.js";
import { RecipeRepository } from "./repository/recipe.repository.js";
import { RecipeScanJobRepository } from "./repository/recipe.scan.job.repository.js";

@Module({})
export class RecipeModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RecipeModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([
                    RecipeScanJobEntity,
                    RecipeCandidateEntity,
                    RecipeEntity,
                    RecipeApplicationEntity,
                    FileAffinityEntity,
                ]),
                databaseModule,
            ],
            controllers: [RecipeScanController],
            providers: [
                RecipeScanJobRepository,
                RecipeCandidateRepository,
                RecipeRepository,
                RecipeApplicationRepository,
                FileAffinityRepository,
                RecipeScanService,
                RecipeScanWorker,
                RecipeMatchingService,
                ListRecipeCandidatesUseCase,
                AcceptRecipeCandidateUseCase,
                DismissRecipeCandidateUseCase,
                ListRecipesUseCase,
                RetireRecipeUseCase,
            ],
            exports: [RecipeScanService, RecipeRepository, RecipeMatchingService],
        };
    }
}
