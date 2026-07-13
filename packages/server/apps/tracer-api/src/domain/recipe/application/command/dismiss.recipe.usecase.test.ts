import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RECIPE_STATUS } from "@monitor/kernel";
import { InvariantViolationError, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import { DismissRecipeUseCase } from "./dismiss.recipe.usecase.js";

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

describe("DismissRecipeUseCase", () => {
    it("존재하지 않는 레시피를 기각하려 하면 NotFound를 던진다", async () => {
        const repo = new InMemoryRecipeRepository();
        const useCase = new DismissRecipeUseCase(repo);
        await expect(useCase.execute("u1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("candidate 레시피를 기각하면 dismissed로 바뀌고 저장된다", async () => {
        const repo = new InMemoryRecipeRepository();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        repo.seed(recipe);
        const useCase = new DismissRecipeUseCase(repo);
        const result = await useCase.execute("u1", "r1");
        expect(result.recipe.status).toBe(RECIPE_STATUS.dismissed);
    });

    it("이미 active인 레시피를 기각하려 하면 도메인 예외가 그대로 전파된다", async () => {
        const repo = new InMemoryRecipeRepository();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        recipe.accept(new Date());
        repo.seed(recipe);
        const useCase = new DismissRecipeUseCase(repo);
        await expect(useCase.execute("u1", "r1")).rejects.toThrow(InvariantViolationError);
    });
});
