import {describe, expect, it} from "vitest";
import {formatRecipeNudge} from "~runtime/domain/recipe/model/recipe.nudge.model.js";

describe("formatRecipeNudge", () => {
    it("항상 넛지 블록을 낸다", () => {
        const nudge = formatRecipeNudge();

        expect(nudge).toContain("<agent-tracer-recipes>");
        expect(nudge).toContain("search_recipes");
        expect(nudge).toContain("</agent-tracer-recipes>");
    });

    it("개수를 세지 않는다", () => {
        expect(formatRecipeNudge()).not.toMatch(/\d+ saved/);
    });

    it("개별 레시피의 id나 title은 싣지 않는다", () => {
        const nudge = formatRecipeNudge();

        expect(nudge).not.toContain("•");
        expect(nudge).not.toMatch(/recipeId|get_recipe/);
    });
});
