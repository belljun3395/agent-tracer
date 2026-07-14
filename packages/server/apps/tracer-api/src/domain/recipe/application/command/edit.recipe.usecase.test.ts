import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { InvariantViolationError, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/recipe/port/__fakes__/fixed.clock.js";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import type { RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
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
        const repo = new InMemoryRecipeRepository();
        const index = { upsert: vi.fn() } as unknown as RecipeSearchPort;
        const useCase = new EditRecipeUseCase(repo, index, clock);

        await expect(useCase.execute("u1", "missing", { title: "새 제목" })).rejects.toThrow(NotFoundException);
    });

    it("다른 사용자의 레시피를 편집하려 하면 NotFound를 던진다", async () => {
        const repo = new InMemoryRecipeRepository();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        recipe.accept(new Date("2026-01-01T00:01:00.000Z"));
        repo.seed(recipe);
        const index = { upsert: vi.fn() } as unknown as RecipeSearchPort;
        const useCase = new EditRecipeUseCase(repo, index, clock);

        await expect(useCase.execute("intruder", "r1", { title: "새 제목" })).rejects.toThrow(NotFoundException);
        expect(repo.all()[0]!.userEdited).toBe(false);
    });

    it("활성 상태가 아닌 레시피를 편집하려 하면 도메인 예외가 전파된다", async () => {
        const repo = new InMemoryRecipeRepository();
        repo.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const index = { upsert: vi.fn() } as unknown as RecipeSearchPort;
        const useCase = new EditRecipeUseCase(repo, index, clock);

        await expect(useCase.execute("u1", "r1", { title: "새 제목" })).rejects.toThrow(InvariantViolationError);
    });

    it("사용자 편집 필드를 저장하고 검색 인덱스를 갱신한다", async () => {
        const repo = new InMemoryRecipeRepository();
        const recipe = RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z"));
        recipe.accept(new Date("2026-01-01T00:01:00.000Z"));
        repo.seed(recipe);
        const upsert = vi.fn(async () => undefined);
        const index = { upsert } as unknown as RecipeSearchPort;
        const useCase = new EditRecipeUseCase(repo, index, clock);

        const result = await useCase.execute("u1", "r1", {
            title: "편집 제목",
            summaryMd: "- 편집한 요약",
        });

        expect(result.recipe.title).toBe("편집 제목");
        expect(result.recipe.userEdited).toBe(true);
        expect(repo.all()[0]!.rev).toBe(2);
        expect(upsert).toHaveBeenCalledWith(repo.all()[0]);
    });
});
