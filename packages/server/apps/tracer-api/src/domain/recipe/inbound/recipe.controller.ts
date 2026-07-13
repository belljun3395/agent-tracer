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
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import {
    applicationsQuerySchema,
    editBodySchema,
    listQuerySchema,
    type ApplicationsQuery,
    type EditBody,
    type ListQuery,
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
    ) {}

    @Get("recipes")
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listRecipes.execute(resolveUserId(user), query.status);
    }

    @Get("recipes/applications")
    async applications(@Query(new SchemaValidationPipe(applicationsQuerySchema)) query: ApplicationsQuery) {
        return this.listApplications.execute(query.recipeId);
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
