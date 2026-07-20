import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RECIPE_STATUS } from "@monitor/kernel";
import { InvariantViolationError, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/recipe/port/__fakes__/fixed.clock.js";
import { InMemoryRecipeTransaction } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import { DismissRecipeUseCase } from "./dismiss.recipe.usecase.js";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

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
        const tx = new InMemoryRecipeTransaction();
        const useCase = new DismissRecipeUseCase(tx, clock);
        await expect(useCase.execute("u1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("candidate 레시피를 기각하면 dismissed로 바뀌고 저장되며 검색 아웃박스에 큐잉된다", async () => {
        const tx = new InMemoryRecipeTransaction();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        tx.recipes.seed(recipe);
        const useCase = new DismissRecipeUseCase(tx, clock);
        const result = await useCase.execute("u1", "r1");
        expect(result.recipe.status).toBe(RECIPE_STATUS.dismissed);
        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["r1"]);
    });

    it("이미 active인 레시피를 기각하려 하면 도메인 예외가 그대로 전파되고 아웃박스에 남지 않는다", async () => {
        const tx = new InMemoryRecipeTransaction();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        recipe.accept(new Date());
        tx.recipes.seed(recipe);
        const useCase = new DismissRecipeUseCase(tx, clock);
        await expect(useCase.execute("u1", "r1")).rejects.toThrow(InvariantViolationError);
        expect(tx.searchOutbox.all()).toEqual([]);
    });
});
