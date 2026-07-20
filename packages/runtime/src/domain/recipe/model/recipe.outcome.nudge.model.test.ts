import {describe, expect, it} from "vitest";
import {formatRecipeOutcomeNudge} from "~runtime/domain/recipe/model/recipe.outcome.nudge.model.js";

describe("formatRecipeOutcomeNudge", () => {
    it("recipeId와 도구 이름과 유일한 신호라는 문장을 담는다", () => {
        const nudge = formatRecipeOutcomeNudge("recipe-42");

        expect(nudge).toContain("recipe-42");
        expect(nudge).toContain("report_recipe_outcome");
        expect(nudge).toContain("only signal recipe quality is judged by");
    });
});
