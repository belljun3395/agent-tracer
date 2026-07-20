import { Inject, Injectable } from "@nestjs/common";
import { RECIPE_STATUSES, type RecipeStatus } from "@monitor/kernel";
import { RecipeLifecycle, type RecipeEntity } from "@monitor/tracer-domain";
import {
    RECIPE_APPLICATION_REPOSITORY,
    type RecipeApplicationRepositoryPort,
} from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { RECIPE_TASK_READER, type RecipeTaskReaderPort } from "~tracer-api/domain/recipe/port/task.reader.port.js";
import { citedTaskIds, mapRecipe, type RecipeWithStatsDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

export interface ListRecipesResult {
    readonly items: readonly RecipeWithStatsDto[];
    readonly taskTitles: Readonly<Record<string, string>>;
}

@Injectable()
export class ListRecipesUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY)
        private readonly applications: RecipeApplicationRepositoryPort,
        @Inject(RECIPE_TASK_READER)
        private readonly tasks: RecipeTaskReaderPort,
    ) {}

    async execute(userId: string, status?: RecipeStatus): Promise<ListRecipesResult> {
        const recipes = await this.collect(userId, status);
        const items: RecipeWithStatsDto[] = [];
        for (const recipe of recipes) {
            const apps = await this.applications.findByRecipe(recipe.id);
            const stats = new RecipeLifecycle(recipe, apps).stats();
            items.push({ ...mapRecipe(recipe), stats });
        }
        return { items, taskTitles: await this.resolveTaskTitles(userId, recipes) };
    }

    private async resolveTaskTitles(
        userId: string,
        recipes: readonly RecipeEntity[],
    ): Promise<Record<string, string>> {
        const ids = citedTaskIds(recipes);
        if (ids.length === 0) return {};
        const tasks = (await this.tasks.findByIds(ids)).filter((task) => task.isOwnedBy(userId));
        const titles: Record<string, string> = {};
        for (const task of tasks) {
            titles[task.id] = task.title;
        }
        return titles;
    }

    private async collect(userId: string, status: RecipeStatus | undefined): Promise<RecipeEntity[]> {
        if (status !== undefined) return this.recipes.findByStatus(userId, status);
        const groups = await Promise.all(RECIPE_STATUSES.map((s) => this.recipes.findByStatus(userId, s)));
        return groups.flat();
    }
}
