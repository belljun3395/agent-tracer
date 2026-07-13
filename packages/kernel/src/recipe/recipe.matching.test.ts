import { describe, expect, it } from "vitest";
import { matchRecipes, type RecipeMatchCandidate } from "./recipe.matching.js";

function recipe(over: Partial<RecipeMatchCandidate> & { id: string; title: string }): RecipeMatchCandidate {
    return { intent: "", description: "", summaryMd: "", ...over };
}

describe("matchRecipes", () => {
    it("프롬프트가 불용어·짧은 토큰뿐이면 빈 배열을 반환한다", () => {
        const result = matchRecipes("the and for", [recipe({ id: "1", title: "database migration guide" })]);
        expect(result).toEqual([]);
    });

    it("레시피가 없으면 빈 배열을 반환한다", () => {
        expect(matchRecipes("run a database migration", [])).toEqual([]);
    });

    it("점수 임계값 이상으로 겹치는 레시피만 반환한다", () => {
        const recipes = [
            recipe({ id: "a", title: "database migration", description: "how to run a database migration safely" }),
            recipe({ id: "b", title: "frontend styling", description: "css and layout tips" }),
        ];
        const result = matchRecipes("please help me run a database migration", recipes);
        expect(result).toHaveLength(1);
        expect(result[0]!.recipeId).toBe("a");
        expect(result[0]!.score).toBeGreaterThan(0);
    });

    it("limit을 지키고 점수 내림차순으로 정렬한다", () => {
        const recipes = [
            recipe({ id: "a", title: "kafka consumer offset lag", description: "kafka consumer offset lag debugging" }),
            recipe({ id: "b", title: "kafka consumer", description: "kafka consumer basics" }),
            recipe({ id: "c", title: "kafka", description: "kafka intro" }),
        ];
        const result = matchRecipes("debug kafka consumer offset lag", recipes, 2);
        expect(result).toHaveLength(2);
        expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score);
    });

    it("토큰화 결과가 비는 레시피는 제외한다", () => {
        const result = matchRecipes("kafka consumer lag", [recipe({ id: "empty", title: "x" })]);
        expect(result).toEqual([]);
    });

    it("limit이 없거나 잘못되면 기본 상한을 쓴다", () => {
        const recipes = Array.from({ length: 6 }, (_unused, i) =>
            recipe({ id: `r${i}`, title: "kafka consumer offset lag", description: "kafka consumer offset lag" }),
        );
        expect(matchRecipes("debug kafka consumer offset lag", recipes)).toHaveLength(3);
        expect(matchRecipes("debug kafka consumer offset lag", recipes, 0)).toHaveLength(3);
    });
});
