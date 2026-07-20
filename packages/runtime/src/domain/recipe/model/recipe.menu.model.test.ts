import {describe, expect, it} from "vitest";
import {buildRecipeMenu, type RecipeMenuItem} from "~runtime/domain/recipe/model/recipe.menu.model.js";

function item(id: string): RecipeMenuItem {
    return {id, title: `title-${id}`, description: `description-${id}`};
}

describe("buildRecipeMenu", () => {
    it("레시피가 없으면 빈 문자열을 낸다", () => {
        expect(buildRecipeMenu([])).toBe("");
    });

    it("레시피마다 id·title·description을 한 줄로 싣는다", () => {
        const menu = buildRecipeMenu([{id: "r1", title: "lint pipeline", description: "린트 전에 부른다"}]);

        expect(menu).toContain("<agent-tracer-recipes>");
        expect(menu).toContain("get_recipe(recipeId)");
        expect(menu).toContain("• r1: lint pipeline — 린트 전에 부른다");
        expect(menu).toContain("</agent-tracer-recipes>");
    });

    it("상한을 넘는 레시피는 자르고 잘린 사실을 표시한다", () => {
        const recipes = Array.from({length: 25}, (_, index) => item(String(index)));

        const menu = buildRecipeMenu(recipes);

        expect(menu).toContain("• 19:");
        expect(menu).not.toContain("• 20:");
        expect(menu).toContain("5 more recipes not shown");
    });

    it("상한 이하이면 잘렸다는 문구를 넣지 않는다", () => {
        const menu = buildRecipeMenu([item("0"), item("1")]);

        expect(menu).not.toContain("more recipes not shown");
    });
});
