import type { Provider, Type } from "@nestjs/common";
import {
    RecipeApplicationRepository,
    RecipeRepository,
    TaskRepository,
    TaskUserStateRepository,
    TransactionRunner,
} from "@monitor/tracer-domain";
import { SystemClock } from "@monitor/platform";
import { AcceptRecipeUseCase } from "~tracer-api/domain/recipe/application/command/accept.recipe.usecase.js";
import { DeleteRecipeUseCase } from "~tracer-api/domain/recipe/application/command/delete.recipe.usecase.js";
import { DismissRecipeUseCase } from "~tracer-api/domain/recipe/application/command/dismiss.recipe.usecase.js";
import { EditRecipeUseCase } from "~tracer-api/domain/recipe/application/command/edit.recipe.usecase.js";
import { RetireRecipeUseCase } from "~tracer-api/domain/recipe/application/command/retire.recipe.usecase.js";
import { GetRecipeUseCase } from "~tracer-api/domain/recipe/application/query/get.recipe.usecase.js";
import { ListRecipeApplicationsUseCase } from "~tracer-api/domain/recipe/application/query/list.recipe.applications.usecase.js";
import { SearchRecipesUseCase } from "~tracer-api/domain/recipe/application/query/search.recipes.usecase.js";
import { ReportRecipeOutcomeUseCase } from "~tracer-api/domain/recipe/application/command/report.recipe.outcome.usecase.js";
import { ListRecipesUseCase } from "~tracer-api/domain/recipe/application/query/list.recipes.usecase.js";
import { CLOCK } from "~tracer-api/domain/recipe/port/clock.port.js";
import { RECIPE_APPLICATION_REPOSITORY } from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";
import { RECIPE_REPOSITORY } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { RECIPE_SEARCH } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { RECIPE_TRANSACTION } from "~tracer-api/domain/recipe/port/recipe.transaction.port.js";
import { RECIPE_TASK_READER } from "~tracer-api/domain/recipe/port/task.reader.port.js";
import { RECIPE_TASK_USER_STATE_READER } from "~tracer-api/domain/recipe/port/task.user.state.reader.port.js";
import { OpenSearchRecipeSearch } from "~tracer-api/domain/recipe/adapter/opensearch.recipe.search.js";
import { RecipeController } from "~tracer-api/domain/recipe/inbound/recipe.controller.js";

export const recipeFeature: { readonly controllers: readonly Type[]; readonly providers: readonly Provider[] } = {
    controllers: [RecipeController],
    providers: [
        AcceptRecipeUseCase,
        DeleteRecipeUseCase,
        DismissRecipeUseCase,
        EditRecipeUseCase,
        RetireRecipeUseCase,
        GetRecipeUseCase,
        ListRecipeApplicationsUseCase,
        SearchRecipesUseCase,
        ReportRecipeOutcomeUseCase,
        ListRecipesUseCase,
        OpenSearchRecipeSearch,
        { provide: CLOCK, useClass: SystemClock },
        { provide: RECIPE_REPOSITORY, useExisting: RecipeRepository },
        { provide: RECIPE_APPLICATION_REPOSITORY, useExisting: RecipeApplicationRepository },
        { provide: RECIPE_SEARCH, useExisting: OpenSearchRecipeSearch },
        { provide: RECIPE_TRANSACTION, useExisting: TransactionRunner },
        { provide: RECIPE_TASK_READER, useExisting: TaskRepository },
        { provide: RECIPE_TASK_USER_STATE_READER, useExisting: TaskUserStateRepository },
    ],
};
