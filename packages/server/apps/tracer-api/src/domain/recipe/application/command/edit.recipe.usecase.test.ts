import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { InvariantViolationError, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/recipe/port/__fakes__/fixed.clock.js";
import { InMemoryRecipeTransaction } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import { EditRecipeUseCase } from "./edit.recipe.usecase.js";

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

describe("EditRecipeUseCase", () => {
    it("존재하지 않는 레시피는 NotFound를 던진다", async () => {
        const tx = new InMemoryRecipeTransaction();
        const useCase = new EditRecipeUseCase(tx, clock);

        await expect(useCase.execute("u1", "missing", { title: "새 제목" })).rejects.toThrow(NotFoundException);
    });

    it("다른 사용자의 레시피를 편집하려 하면 NotFound를 던진다", async () => {
        const tx = new InMemoryRecipeTransaction();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        recipe.accept(new Date("2026-01-01T00:01:00.000Z"));
        tx.recipes.seed(recipe);
        const useCase = new EditRecipeUseCase(tx, clock);

        await expect(useCase.execute("intruder", "r1", { title: "새 제목" })).rejects.toThrow(NotFoundException);
        expect(tx.recipes.all()[0]!.userEdited).toBe(false);
    });

    it("활성 상태가 아닌 레시피를 편집하려 하면 도메인 예외가 전파된다", async () => {
        const tx = new InMemoryRecipeTransaction();
        tx.recipes.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const useCase = new EditRecipeUseCase(tx, clock);

        await expect(useCase.execute("u1", "r1", { title: "새 제목" })).rejects.toThrow(InvariantViolationError);
    });

    it("사용자 편집 필드를 저장하고 검색 아웃박스에 큐잉한다", async () => {
        const tx = new InMemoryRecipeTransaction();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        recipe.accept(new Date("2026-01-01T00:01:00.000Z"));
        tx.recipes.seed(recipe);
        const useCase = new EditRecipeUseCase(tx, clock);

        const result = await useCase.execute("u1", "r1", {
            title: "편집 제목",
            summaryMd: "- 편집한 요약",
        });

        expect(result.recipe.title).toBe("편집 제목");
        expect(result.recipe.userEdited).toBe(true);
        expect(tx.recipes.all()[0]!.rev).toBe(2);
        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["r1"]);
    });
});
