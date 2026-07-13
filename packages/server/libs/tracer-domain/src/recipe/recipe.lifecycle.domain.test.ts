import { describe, expect, it } from "vitest";
import { RECIPE_OUTCOME } from "@monitor/kernel";
import { RecipeEntity } from "./recipe.entity.js";
import { RecipeApplicationEntity } from "./application/recipe.application.entity.js";
import { RecipeLifecycle } from "./recipe.lifecycle.domain.js";
import type { RecipeCandidateInput } from "./recipe.types.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRecipe(): RecipeEntity {
    const input: RecipeCandidateInput = {
        id: "r1",
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
    const recipe = RecipeEntity.candidate(input, NOW);
    recipe.accept(NOW);
    return recipe;
}

function makeApplication(overrides: Partial<RecipeApplicationEntity> = {}): RecipeApplicationEntity {
    const app = new RecipeApplicationEntity();
    app.id = overrides.id ?? "app1";
    app.userId = "u1";
    app.recipeId = "r1";
    app.taskId = overrides.taskId ?? "task1";
    app.injectedVia = "auto";
    app.score = null;
    app.outcome = overrides.outcome ?? null;
    app.createdAt = NOW;
    app.resolvedAt = null;
    return app;
}

describe("RecipeLifecycle", () => {
    describe("stats", () => {
        it("적용 이력이 없으면 successRate는 0이다", () => {
            const lifecycle = new RecipeLifecycle(makeRecipe(), []);
            expect(lifecycle.stats()).toEqual({ applied: 0, success: 0, successRate: 0 });
        });

        it("completed 결과의 비율로 successRate를 계산한다", () => {
            const applications = [
                makeApplication({ id: "a", outcome: RECIPE_OUTCOME.completed }),
                makeApplication({ id: "b", outcome: RECIPE_OUTCOME.abandoned }),
                makeApplication({ id: "c", outcome: RECIPE_OUTCOME.completed }),
            ];
            const lifecycle = new RecipeLifecycle(makeRecipe(), applications);
            expect(lifecycle.stats()).toEqual({ applied: 3, success: 2, successRate: 2 / 3 });
        });
    });

    describe("resolveOutcomes", () => {
        it("태스크가 completed로 끝나면 해당 태스크의 미해결 이력을 completed로 확정한다", () => {
            const application = makeApplication({ taskId: "task1", outcome: null });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveOutcomes("completed", "task1", NOW);
            expect(changed).toHaveLength(1);
            expect(application.outcome).toBe(RECIPE_OUTCOME.completed);
        });

        it("태스크가 errored로 끝나면 abandoned로 확정한다", () => {
            const application = makeApplication({ taskId: "task1", outcome: null });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            lifecycle.resolveOutcomes("errored", "task1", NOW);
            expect(application.outcome).toBe(RECIPE_OUTCOME.abandoned);
        });

        it("completed/errored가 아닌 상태로는 아무것도 확정하지 않는다", () => {
            const application = makeApplication({ taskId: "task1", outcome: null });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveOutcomes("running", "task1", NOW);
            expect(changed).toEqual([]);
            expect(application.outcome).toBeNull();
        });

        it("다른 태스크의 이력은 건드리지 않는다", () => {
            const application = makeApplication({ taskId: "other-task", outcome: null });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveOutcomes("completed", "task1", NOW);
            expect(changed).toEqual([]);
        });

        it("이미 확정된 이력은 다시 확정하지 않는다", () => {
            const application = makeApplication({ taskId: "task1", outcome: RECIPE_OUTCOME.completed });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveOutcomes("completed", "task1", NOW);
            expect(changed).toEqual([]);
        });
    });
});
