import {describe, expect, it} from "vitest";
import {formatRecipeNudge} from "~runtime/domain/recipe/model/recipe.nudge.model.js";

describe("formatRecipeNudge", () => {
    it("레시피가 없으면 빈 문자열을 낸다", () => {
        expect(formatRecipeNudge(0)).toBe("");
    });

    it("레시피 개수를 문구에 담고 search_recipes 호출을 안내한다", () => {
        const nudge = formatRecipeNudge(4);

        expect(nudge).toContain("<agent-tracer-recipes>");
        expect(nudge).toContain("4 saved recipes");
        expect(nudge).toContain("search_recipes");
        expect(nudge).toContain("</agent-tracer-recipes>");
    });

    it("개별 레시피의 id나 title은 싣지 않는다", () => {
        const nudge = formatRecipeNudge(2);

        expect(nudge).not.toContain("•");
        expect(nudge).not.toMatch(/recipeId|get_recipe/);
    });
});
