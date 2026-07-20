import { describe, expect, it } from "vitest";
import { RECIPE_OUTCOME } from "@monitor/kernel";
import { RecipeApplicationEntity, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { InMemoryRecipeApplicationRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import { GetRecipeUseCase } from "./get.recipe.usecase.js";

function candidateInput(id: string): RecipeCandidateInput {
    return {
        id,
        userId: "u1",
        title: "제목",
        intent: "intent",
        description: "설명",
        summaryMd: "요약",
        request: "사용자가 작업 절차를 recipe로 만들라고 했다.",
        corrections: [],
        pitfalls: [],
        governingRules: [],
        steps: [],
        touchedFiles: [],
        contributingSlices: [],
    };
}

function makeApplication(recipeId: string, outcome: RecipeApplicationEntity["outcome"]): RecipeApplicationEntity {
    const app = new RecipeApplicationEntity();
    app.id = `app-${Math.random()}`;
    app.userId = "u1";
    app.recipeId = recipeId;
    app.taskId = "task-1";
    app.injectedVia = "pull";
    app.outcome = outcome;
    app.createdAt = new Date("2026-01-01T00:00:00.000Z");
    app.resolvedAt = null;
    return app;
}

describe("GetRecipeUseCase", () => {
    it("존재하지 않는 레시피는 null을 반환한다", async () => {
        const recipes = new InMemoryRecipeRepository();
        const applications = new InMemoryRecipeApplicationRepository();
        const useCase = new GetRecipeUseCase(recipes, applications);
        expect(await useCase.execute("u1", "missing")).toBeNull();
    });

    it("레시피와 적용 이력·통계를 함께 반환한다", async () => {
        const recipes = new InMemoryRecipeRepository();
        const applications = new InMemoryRecipeApplicationRepository();
        recipes.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        applications.seed(
            makeApplication("r1", RECIPE_OUTCOME.completed),
            makeApplication("r1", RECIPE_OUTCOME.abandoned),
        );
        const useCase = new GetRecipeUseCase(recipes, applications);
        const detail = await useCase.execute("u1", "r1");
        expect(detail?.recipe.id).toBe("r1");
        expect(detail?.applications).toHaveLength(2);
        expect(detail?.stats).toEqual({ applied: 2, success: 1, successRate: 0.5 });
    });
});
