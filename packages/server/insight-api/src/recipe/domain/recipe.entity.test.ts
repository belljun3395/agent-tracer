import { describe, expect, it } from "vitest";
import { RecipeEntity } from "./recipe.entity.js";

function makeRecipe(overrides: Partial<RecipeEntity> = {}): RecipeEntity {
    return Object.assign(new RecipeEntity(), {
        id: "r1",
        sourceCandidateId: null,
        title: "제목",
        intent: "의도",
        description: "설명",
        summaryMd: "",
        stepsJson: "[]",
        touchedFilesJson: "[]",
        contributingSlicesJson: "[]",
        rev: 1,
        parentRecipeId: null,
        status: "active" as const,
        appliedCount: 0,
        successCount: 0,
        language: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    }, overrides);
}

const FIFTEEN_DAYS_LATER = "2026-01-16T00:00:00.000Z";
const NINE_DAYS_LATER = "2026-01-10T00:00:00.000Z";

describe("RecipeEntity.successRate — 성공률 계산", () => {
    it("적용 이력이 없으면 성공률은 0이다", () => {
        const recipe = makeRecipe({ appliedCount: 0, successCount: 0 });
        expect(recipe.successRate()).toBe(0);
    });

    it("성공률은 성공 횟수를 적용 횟수로 나눈 값이다", () => {
        const recipe = makeRecipe({ appliedCount: 4, successCount: 1 });
        expect(recipe.successRate()).toBe(0.25);
    });
});

describe("RecipeEntity.shouldRetire — 자동 폐기 정책", () => {
    it("적용 5회 이상이고 성공률이 30% 미만이면 폐기 대상이다", () => {
        const recipe = makeRecipe({ appliedCount: 10, successCount: 2 });
        expect(recipe.shouldRetire(FIFTEEN_DAYS_LATER)).toBe(true);
    });

    it("적용 5회 이상이어도 성공률이 30% 이상이면 폐기하지 않는다", () => {
        const recipe = makeRecipe({ appliedCount: 10, successCount: 5 });
        expect(recipe.shouldRetire(FIFTEEN_DAYS_LATER)).toBe(false);
    });

    it("한 번도 적용되지 않고 생성 후 14일이 지나면 폐기 대상이다", () => {
        const recipe = makeRecipe({ appliedCount: 0, successCount: 0 });
        expect(recipe.shouldRetire(FIFTEEN_DAYS_LATER)).toBe(true);
    });

    it("한 번도 적용되지 않았어도 14일이 지나지 않았으면 폐기하지 않는다", () => {
        const recipe = makeRecipe({ appliedCount: 0, successCount: 0 });
        expect(recipe.shouldRetire(NINE_DAYS_LATER)).toBe(false);
    });

    it("active 상태가 아니면 폐기 조건을 만족해도 폐기하지 않는다", () => {
        const recipe = makeRecipe({ status: "superseded", appliedCount: 10, successCount: 0 });
        expect(recipe.shouldRetire(FIFTEEN_DAYS_LATER)).toBe(false);
    });
});
