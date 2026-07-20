import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { ListRecipesUseCase } from "~tracer-api/domain/recipe/application/query/list.recipes.usecase.js";
import { GetRecipeUseCase } from "~tracer-api/domain/recipe/application/query/get.recipe.usecase.js";
import { AcceptRecipeUseCase } from "~tracer-api/domain/recipe/application/command/accept.recipe.usecase.js";
import { DismissRecipeUseCase } from "~tracer-api/domain/recipe/application/command/dismiss.recipe.usecase.js";
import { EditRecipeUseCase } from "~tracer-api/domain/recipe/application/command/edit.recipe.usecase.js";
import { RetireRecipeUseCase } from "~tracer-api/domain/recipe/application/command/retire.recipe.usecase.js";
import { DeleteRecipeUseCase } from "~tracer-api/domain/recipe/application/command/delete.recipe.usecase.js";
import { ListRecipeApplicationsUseCase } from "~tracer-api/domain/recipe/application/query/list.recipe.applications.usecase.js";
import { SearchRecipesUseCase } from "~tracer-api/domain/recipe/application/query/search.recipes.usecase.js";
import { ReportRecipeOutcomeUseCase } from "~tracer-api/domain/recipe/application/command/report.recipe.outcome.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import {
    applicationsQuerySchema,
    editBodySchema,
    listQuerySchema,
    outcomeBodySchema,
    searchQuerySchema,
    type ApplicationsQuery,
    type EditBody,
    type ListQuery,
    type OutcomeBody,
    type SearchQuery,
} from "./recipe.schema.js";

@Controller("api/v1")
export class RecipeController {
    constructor(
        private readonly listRecipes: ListRecipesUseCase,
        private readonly getRecipe: GetRecipeUseCase,
        private readonly acceptRecipe: AcceptRecipeUseCase,
        private readonly dismissRecipe: DismissRecipeUseCase,
        private readonly editRecipe: EditRecipeUseCase,
        private readonly retireRecipe: RetireRecipeUseCase,
        private readonly deleteRecipe: DeleteRecipeUseCase,
        private readonly listApplications: ListRecipeApplicationsUseCase,
        private readonly searchRecipes: SearchRecipesUseCase,
        private readonly reportOutcome: ReportRecipeOutcomeUseCase,
    ) {}

    @Get("recipes")
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listRecipes.execute(resolveUserId(user), query.status);
    }

    @Get("recipes/applications")
    async applications(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(applicationsQuerySchema)) query: ApplicationsQuery,
    ) {
        const result = await this.listApplications.execute(resolveUserId(user), query.recipeId);
        if (result === null) throw new NotFoundException("Recipe not found");
        return result;
    }

    @Get("recipes/search")
    async search(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(searchQuerySchema)) query: SearchQuery,
    ) {
        return this.searchRecipes.execute({
            userId: resolveUserId(user),
            q: query.q ?? "",
            ...(query.limit !== undefined ? { limit: query.limit } : {}),
        });
    }

    @Get("recipes/:id")
    async get(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const detail = await this.getRecipe.execute(resolveUserId(user), id);
        if (detail === null) throw new NotFoundException("Recipe not found");
        return detail;
    }

    @Post("recipes/:id/accept")
    @HttpCode(HttpStatus.OK)
    async accept(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.acceptRecipe.execute(resolveUserId(user), id);
    }

    @Post("recipes/:id/dismiss")
    @HttpCode(HttpStatus.OK)
    async dismiss(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.dismissRecipe.execute(resolveUserId(user), id);
    }

    @Post("recipes/:id/outcome")
    @HttpCode(HttpStatus.OK)
    async reportOutcomeFor(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(outcomeBodySchema)) body: OutcomeBody,
    ) {
        return this.reportOutcome.execute(resolveUserId(user), id, body.taskId, body.outcome, body.note);
    }

    @Patch("recipes/:id")
    async edit(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(editBodySchema)) body: EditBody,
    ) {
        return this.editRecipe.execute(resolveUserId(user), id, body);
    }

    @Post("recipes/:id/retire")
    @HttpCode(HttpStatus.OK)
    async retire(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.retireRecipe.execute(resolveUserId(user), id);
    }

    @Delete("recipes/:id")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.deleteRecipe.execute(resolveUserId(user), id);
    }
}
