import { describe, expect, it } from "vitest";
import { RECIPE_OUTCOME } from "@monitor/kernel";
import { RecipeApplicationEntity } from "@monitor/tracer-domain";
import { InMemoryRecipeApplicationRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { ListRecipeApplicationsUseCase } from "./list.recipe.applications.usecase.js";

function application(id: string, recipeId: string, createdAt: string): RecipeApplicationEntity {
    const entity = new RecipeApplicationEntity();
    entity.id = id;
    entity.userId = "u1";
    entity.recipeId = recipeId;
    entity.taskId = "t1";
    entity.injectedVia = "auto";
    entity.score = null;
    entity.outcome = null;
    entity.createdAt = new Date(createdAt);
    entity.resolvedAt = null;
    return entity;
}

function makeUseCase(applications: RecipeApplicationEntity[]): ListRecipeApplicationsUseCase {
    const repo = new InMemoryRecipeApplicationRepository();
    repo.seed(...applications);
    return new ListRecipeApplicationsUseCase(repo);
}

describe("ListRecipeApplicationsUseCase", () => {
    it("해당 레시피의 적용 이력만 골라 DTO로 반환한다", async () => {
        const target = application("a1", "r1", "2026-01-01T00:00:00.000Z");
        target.resolve(RECIPE_OUTCOME.completed, new Date("2026-01-02T00:00:00.000Z"));
        const other = application("a2", "r2", "2026-01-01T00:00:00.000Z");
        const useCase = makeUseCase([target, other]);

        const result = await useCase.execute("r1");

        expect(result.items.map((item) => item.id)).toEqual(["a1"]);
        expect(result.items[0]?.outcome).toBe(RECIPE_OUTCOME.completed);
    });

    it("적용 이력이 없으면 빈 목록을 반환한다", async () => {
        const useCase = makeUseCase([]);

        const result = await useCase.execute("r1");

        expect(result.items).toEqual([]);
    });
});
