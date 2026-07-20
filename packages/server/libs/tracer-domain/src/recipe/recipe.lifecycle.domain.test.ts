import { describe, expect, it } from "vitest";
import { RecipeEntity } from "./recipe.entity.js";
import { RecipeApplicationEntity } from "./application/recipe.application.entity.js";
import { RecipeLifecycle } from "./recipe.lifecycle.domain.js";
import type { RecipeCandidateInput } from "./recipe.types.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRecipe(input: Partial<RecipeCandidateInput> = {}, createdAt: Date = NOW): RecipeEntity {
    const base: RecipeCandidateInput = {
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
        ...input,
    };
    const recipe = RecipeEntity.candidate(base, createdAt);
    recipe.accept(createdAt);
    return recipe;
}

function makeApplication(overrides: Partial<RecipeApplicationEntity> = {}): RecipeApplicationEntity {
    const app = new RecipeApplicationEntity();
    app.id = overrides.id ?? "app1";
    app.userId = "u1";
    app.recipeId = "r1";
    app.taskId = overrides.taskId ?? "task1";
    app.injectedVia = "pull";
    app.outcome = overrides.outcome ?? null;
    app.note = null;
    app.anchorEventId = overrides.anchorEventId ?? "anchor1";
    app.anchorSeq = overrides.anchorSeq ?? "1";
    app.createdAt = NOW;
    return app;
}

describe("RecipeLifecycle", () => {
    describe("stats", () => {
        it("적용 이력이 없으면 applicationCount와 successRate가 모두 0이다", () => {
            const lifecycle = new RecipeLifecycle(makeRecipe(), []);
            expect(lifecycle.stats()).toEqual({
                applicationCount: 0,
                decidedCount: 0,
                successRate: 0,
            });
        });

        it("completed 자기보고 비율로 successRate를 계산한다", () => {
            const applications = [
                makeApplication({ id: "a", outcome: "completed" }),
                makeApplication({ id: "b", outcome: "abandoned" }),
                makeApplication({ id: "c", outcome: "completed" }),
            ];
            const lifecycle = new RecipeLifecycle(makeRecipe(), applications);
            expect(lifecycle.stats()).toEqual({
                applicationCount: 3,
                decidedCount: 3,
                successRate: 2 / 3,
            });
        });

        it("자기보고가 없는 적용은 decidedCount와 successRate의 분모에서 빠지지만 applicationCount에는 들어간다", () => {
            const applications = [
                makeApplication({ id: "a", outcome: "completed" }),
                makeApplication({ id: "b", outcome: null }),
                makeApplication({ id: "c", outcome: null }),
            ];
            const lifecycle = new RecipeLifecycle(makeRecipe(), applications);
            expect(lifecycle.stats()).toEqual({
                applicationCount: 3,
                decidedCount: 1,
                successRate: 1,
            });
        });
    });
});
