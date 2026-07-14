import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RECIPE_STATUS } from "@monitor/kernel";
import { RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/recipe/port/__fakes__/fixed.clock.js";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import { AcceptRecipeUseCase } from "./accept.recipe.usecase.js";

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

describe("AcceptRecipeUseCase", () => {
    it("존재하지 않는 레시피를 채택하려 하면 NotFound를 던진다", async () => {
        const repo = new InMemoryRecipeRepository();
        const useCase = new AcceptRecipeUseCase(repo, clock);
        await expect(useCase.execute("u1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("다른 사용자의 레시피를 채택하려 하면 NotFound를 던진다", async () => {
        const repo = new InMemoryRecipeRepository();
        repo.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const useCase = new AcceptRecipeUseCase(repo, clock);
        await expect(useCase.execute("intruder", "r1")).rejects.toThrow(NotFoundException);
        expect(repo.all()[0]!.status).toBe(RECIPE_STATUS.candidate);
    });

    it("candidate 레시피를 채택하면 active로 바뀌고 저장된다", async () => {
        const repo = new InMemoryRecipeRepository();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        repo.seed(recipe);
        const useCase = new AcceptRecipeUseCase(repo, clock);
        const result = await useCase.execute("u1", "r1");
        expect(result.recipe.status).toBe(RECIPE_STATUS.active);
        expect(repo.all()[0]!.status).toBe(RECIPE_STATUS.active);
    });

    it("부모가 있는 revision 후보를 채택하면 부모를 superseded로 바꾼다", async () => {
        const repo = new InMemoryRecipeRepository();
        const parent = RecipeEntity.candidate(candidateInput("parent"), new Date("2026-01-01T00:00:00.000Z"));
        parent.accept(new Date("2026-01-01T00:01:00.000Z"));
        const child = RecipeEntity.candidate(
            { ...candidateInput("child"), parentRecipeId: "parent" },
            new Date("2026-01-01T00:02:00.000Z"),
        );
        repo.seed(parent, child);
        const useCase = new AcceptRecipeUseCase(repo, clock);

        const result = await useCase.execute("u1", "child");

        expect(result.recipe.status).toBe(RECIPE_STATUS.active);
        expect(repo.all().find((r) => r.id === "parent")?.status).toBe(RECIPE_STATUS.superseded);
    });
});
