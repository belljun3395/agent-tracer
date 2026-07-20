import { describe, expect, it } from "vitest";
import { RECIPE_OUTCOME } from "@monitor/kernel";
import { RecipeApplicationEntity, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { InMemoryRecipeApplicationRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import { ListRecipeApplicationsUseCase } from "./list.recipe.applications.usecase.js";

function candidateInput(id: string, userId: string): RecipeCandidateInput {
    return {
        id,
        userId,
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

function application(id: string, recipeId: string, createdAt: string): RecipeApplicationEntity {
    const entity = new RecipeApplicationEntity();
    entity.id = id;
    entity.userId = "u1";
    entity.recipeId = recipeId;
    entity.taskId = "t1";
    entity.injectedVia = "pull";
    entity.outcome = null;
    entity.createdAt = new Date(createdAt);
    entity.resolvedAt = null;
    return entity;
}

function makeUseCase(
    applications: RecipeApplicationEntity[],
    recipes: RecipeEntity[] = [],
): ListRecipeApplicationsUseCase {
    const recipeRepo = new InMemoryRecipeRepository();
    recipeRepo.seed(...recipes);
    const applicationRepo = new InMemoryRecipeApplicationRepository();
    applicationRepo.seed(...applications);
    return new ListRecipeApplicationsUseCase(recipeRepo, applicationRepo);
}

describe("ListRecipeApplicationsUseCase", () => {
    it("해당 레시피의 적용 이력만 골라 DTO로 반환한다", async () => {
        const target = application("a1", "r1", "2026-01-01T00:00:00.000Z");
        target.resolve(RECIPE_OUTCOME.completed, new Date("2026-01-02T00:00:00.000Z"));
        const other = application("a2", "r2", "2026-01-01T00:00:00.000Z");
        const recipe = RecipeEntity.candidate(candidateInput("r1", "u1"), new Date("2026-01-01T00:00:00.000Z"));
        const useCase = makeUseCase([target, other], [recipe]);

        const result = await useCase.execute("u1", "r1");

        expect(result?.items.map((item) => item.id)).toEqual(["a1"]);
        expect(result?.items[0]?.outcome).toBe(RECIPE_OUTCOME.completed);
    });

    it("적용 이력이 없으면 빈 목록을 반환한다", async () => {
        const recipe = RecipeEntity.candidate(candidateInput("r1", "u1"), new Date("2026-01-01T00:00:00.000Z"));
        const useCase = makeUseCase([], [recipe]);

        const result = await useCase.execute("u1", "r1");

        expect(result?.items).toEqual([]);
    });

    it("존재하지 않는 레시피는 null을 반환한다", async () => {
        const useCase = makeUseCase([]);

        const result = await useCase.execute("u1", "missing");

        expect(result).toBeNull();
    });

    it("다른 사용자의 레시피는 소유자가 아니므로 null을 반환한다", async () => {
        const target = application("a1", "r1", "2026-01-01T00:00:00.000Z");
        const recipe = RecipeEntity.candidate(candidateInput("r1", "owner"), new Date("2026-01-01T00:00:00.000Z"));
        const useCase = makeUseCase([target], [recipe]);

        const result = await useCase.execute("intruder", "r1");

        expect(result).toBeNull();
    });
});
