import {describe, expect, it} from "vitest";
import {parseGetRecipeArgs} from "~runtime/domain/recipe/model/get.recipe.tool.model.js";

describe("parseGetRecipeArgs", () => {
    it("recipeId가 있으면 유효한 인자로 읽는다", () => {
        expect(parseGetRecipeArgs({recipeId: "r1"})).toEqual({recipeId: "r1"});
    });

    it("recipeId가 없거나 비어 있으면 거부한다", () => {
        expect(parseGetRecipeArgs({})).toBeNull();
        expect(parseGetRecipeArgs({recipeId: "   "})).toBeNull();
        expect(parseGetRecipeArgs({recipeId: 1})).toBeNull();
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseGetRecipeArgs(null)).toBeNull();
        expect(parseGetRecipeArgs("recipeId")).toBeNull();
    });
});
