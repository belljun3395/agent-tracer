import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RecipeOutcome } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { RecipeApplicationEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/recipe/port/clock.port.js";
import {
    RECIPE_APPLICATION_REPOSITORY,
    type RecipeApplicationRepositoryPort,
} from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { mapRecipeApplication, type RecipeApplicationDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

function manualApplication(userId: string, recipeId: string, taskId: string, now: Date): RecipeApplicationEntity {
    const application = new RecipeApplicationEntity();
    application.id = generateUlid(now.getTime());
    application.userId = userId;
    application.recipeId = recipeId;
    application.taskId = taskId;
    application.injectedVia = "manual";
    application.outcome = null;
    application.note = null;
    application.anchorEventId = null;
    application.anchorSeq = null;
    application.createdAt = now;
    return application;
}

/** 에이전트의 자기보고이며 이 태스크에 이미 열린 적용 이력이 없으면 즉석에서 하나 만든다. */
@Injectable()
export class ReportRecipeOutcomeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY)
        private readonly applications: RecipeApplicationRepositoryPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(
        userId: string,
        recipeId: string,
        taskId: string,
        outcome: RecipeOutcome,
        note?: string,
    ): Promise<{ readonly application: RecipeApplicationDto }> {
        const recipe = await this.recipes.findById(recipeId);
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");

        const now = this.clock.now();
        const existing = (await this.applications.findByTask(taskId)).find((a) => a.recipeId === recipeId);
        const application = existing ?? manualApplication(userId, recipeId, taskId, now);
        application.reportOutcome(outcome, note ?? null);
        await this.applications.upsert(application);

        return { application: mapRecipeApplication(application) };
    }
}
