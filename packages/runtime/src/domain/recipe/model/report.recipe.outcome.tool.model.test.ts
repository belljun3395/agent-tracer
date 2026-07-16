import {describe, expect, it} from "vitest";
import {parseReportRecipeOutcomeArgs} from "~runtime/domain/recipe/model/report.recipe.outcome.tool.model.js";

describe("parseReportRecipeOutcomeArgs", () => {
    it("recipeId와 유효한 outcome이 있으면 읽는다", () => {
        expect(parseReportRecipeOutcomeArgs({recipeId: "r1", outcome: "completed"}))
            .toEqual({recipeId: "r1", outcome: "completed"});
    });

    it("note가 있으면 함께 읽는다", () => {
        expect(parseReportRecipeOutcomeArgs({recipeId: "r1", outcome: "abandoned", note: "안 맞았다"}))
            .toEqual({recipeId: "r1", outcome: "abandoned", note: "안 맞았다"});
    });

    it("outcome이 유효한 값이 아니면 거부한다", () => {
        expect(parseReportRecipeOutcomeArgs({recipeId: "r1", outcome: "helpful"})).toBeNull();
        expect(parseReportRecipeOutcomeArgs({recipeId: "r1"})).toBeNull();
    });

    it("recipeId가 없으면 거부한다", () => {
        expect(parseReportRecipeOutcomeArgs({outcome: "completed"})).toBeNull();
        expect(parseReportRecipeOutcomeArgs({recipeId: "  ", outcome: "completed"})).toBeNull();
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseReportRecipeOutcomeArgs(null)).toBeNull();
    });
});
