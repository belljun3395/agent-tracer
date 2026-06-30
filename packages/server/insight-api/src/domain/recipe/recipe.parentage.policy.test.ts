import { describe, expect, it } from "vitest";
import { RecipeEntity } from "@monitor/insight-api/domain/recipe/recipe.entity.js";
import { jaccardOverlap, pickBestParent } from "@monitor/insight-api/domain/recipe/recipe.parentage.policy.js";

function recipe(id: string): RecipeEntity {
    return Object.assign(new RecipeEntity(), { id });
}

describe("jaccardOverlap — 태스크 집합 중첩도", () => {
    it("두 집합 중 하나가 비어 있으면 0이다", () => {
        expect(jaccardOverlap(new Set(["a"]), new Set())).toBe(0);
        expect(jaccardOverlap(new Set(), new Set(["a"]))).toBe(0);
    });

    it("완전히 같은 집합이면 1이다", () => {
        expect(jaccardOverlap(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    });

    it("교집합/합집합 비율로 계산된다", () => {

        expect(jaccardOverlap(new Set(["a", "b"]), new Set(["a", "c"]))).toBeCloseTo(1 / 3);
    });
});

describe("pickBestParent — 부모 레시피 선택", () => {
    it("중첩이 임계값(0.5)을 넘는 활성 레시피가 없으면 부모는 없다(null)", () => {
        const parent = pickBestParent(new Set(["a", "b"]), [
            { recipe: recipe("r1"), taskIds: new Set(["a", "c", "d", "e"]) },
        ]);
        expect(parent).toBeNull();
    });

    it("임계값을 넘는 레시피 중 중첩이 가장 큰 것을 부모로 고른다", () => {
        const best = recipe("best");
        const parent = pickBestParent(new Set(["a", "b", "c"]), [
            { recipe: recipe("weak"), taskIds: new Set(["a"]) },
            { recipe: best, taskIds: new Set(["a", "b", "c"]) },
        ]);
        expect(parent).toBe(best);
    });
});
