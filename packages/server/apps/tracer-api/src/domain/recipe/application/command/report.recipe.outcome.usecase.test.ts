import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RECIPE_OUTCOME } from "@monitor/kernel";
import { RecipeApplicationEntity, RecipeEntity, type RecipeCandidateInput } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/recipe/port/__fakes__/fixed.clock.js";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import { InMemoryRecipeApplicationRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { ReportRecipeOutcomeUseCase } from "./report.recipe.outcome.usecase.js";

const clock = new FixedClock(new Date("2026-01-02T00:00:00.000Z"));

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

function application(overrides: Partial<RecipeApplicationEntity>): RecipeApplicationEntity {
    const entity = new RecipeApplicationEntity();
    entity.id = "app-1";
    entity.userId = "u1";
    entity.recipeId = "r1";
    entity.taskId = "t1";
    entity.injectedVia = "auto";
    entity.score = 0.9;
    entity.outcome = null;
    entity.note = null;
    entity.createdAt = new Date("2026-01-01T00:00:00.000Z");
    entity.resolvedAt = null;
    return Object.assign(entity, overrides);
}

describe("ReportRecipeOutcomeUseCase", () => {
    it("존재하지 않는 레시피면 NotFound를 던진다", async () => {
        const recipes = new InMemoryRecipeRepository();
        const applications = new InMemoryRecipeApplicationRepository();
        const useCase = new ReportRecipeOutcomeUseCase(recipes, applications, clock);

        await expect(useCase.execute("u1", "missing", "t1", RECIPE_OUTCOME.completed)).rejects.toThrow(NotFoundException);
    });

    it("다른 사용자의 레시피면 NotFound를 던진다", async () => {
        const recipes = new InMemoryRecipeRepository();
        recipes.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const applications = new InMemoryRecipeApplicationRepository();
        const useCase = new ReportRecipeOutcomeUseCase(recipes, applications, clock);

        await expect(useCase.execute("intruder", "r1", "t1", RECIPE_OUTCOME.completed)).rejects.toThrow(NotFoundException);
    });

    it("이 태스크에 열린 적용 이력이 있으면 그것을 확정한다", async () => {
        const recipes = new InMemoryRecipeRepository();
        recipes.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const applications = new InMemoryRecipeApplicationRepository();
        applications.seed(application({}));
        const useCase = new ReportRecipeOutcomeUseCase(recipes, applications, clock);

        const result = await useCase.execute("u1", "r1", "t1", RECIPE_OUTCOME.completed, "잘 맞았다");

        expect(result.application.id).toBe("app-1");
        expect(result.application.outcome).toBe(RECIPE_OUTCOME.completed);
        expect(result.application.note).toBe("잘 맞았다");
        expect(applications.all()).toHaveLength(1);
    });

    it("열린 적용 이력이 없으면 manual로 새로 만들어 즉시 확정한다", async () => {
        const recipes = new InMemoryRecipeRepository();
        recipes.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const applications = new InMemoryRecipeApplicationRepository();
        const useCase = new ReportRecipeOutcomeUseCase(recipes, applications, clock);

        const result = await useCase.execute("u1", "r1", "t1", RECIPE_OUTCOME.abandoned);

        expect(applications.all()).toHaveLength(1);
        expect(applications.all()[0]?.injectedVia).toBe("manual");
        expect(result.application.outcome).toBe(RECIPE_OUTCOME.abandoned);
        expect(result.application.note).toBeNull();
    });

    it("다른 레시피의 열린 이력은 건드리지 않는다", async () => {
        const recipes = new InMemoryRecipeRepository();
        recipes.seed(RecipeEntity.candidate(candidateInput("r1"), new Date("2026-01-01T00:00:00.000Z")));
        const applications = new InMemoryRecipeApplicationRepository();
        applications.seed(application({recipeId: "other-recipe", id: "other-app"}));
        const useCase = new ReportRecipeOutcomeUseCase(recipes, applications, clock);

        await useCase.execute("u1", "r1", "t1", RECIPE_OUTCOME.completed);

        expect(applications.all()).toHaveLength(2);
        expect(applications.all().find((a) => a.id === "other-app")?.outcome).toBeNull();
    });
});
