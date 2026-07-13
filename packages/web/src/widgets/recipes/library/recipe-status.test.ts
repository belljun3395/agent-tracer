import { describe, expect, it } from "vitest";
import type { Recipe, RecipeStatus } from "~web/entities/recipe/model/recipe.js";
import { canDeleteRecipe, isArchivedRecipe } from "~web/widgets/recipes/library/recipe-status.js";

function makeRecipe(status: RecipeStatus): Recipe {
  return { id: "r1", status } as unknown as Recipe;
}

describe("isArchivedRecipe", () => {
  it("활성도 후보도 아니면 보관함으로 본다", () => {
    expect(isArchivedRecipe(makeRecipe("retired"))).toBe(true);
    expect(isArchivedRecipe(makeRecipe("superseded"))).toBe(true);
    expect(isArchivedRecipe(makeRecipe("dismissed"))).toBe(true);
  });

  it("활성과 후보는 보관함이 아니다", () => {
    expect(isArchivedRecipe(makeRecipe("active"))).toBe(false);
    expect(isArchivedRecipe(makeRecipe("candidate"))).toBe(false);
  });
});

describe("canDeleteRecipe", () => {
  it("기각·폐기된 레시피만 지울 수 있다", () => {
    expect(canDeleteRecipe(makeRecipe("dismissed"))).toBe(true);
    expect(canDeleteRecipe(makeRecipe("retired"))).toBe(true);
  });

  it("대체된 레시피는 계보 노드라 지울 수 없다", () => {
    expect(canDeleteRecipe(makeRecipe("superseded"))).toBe(false);
  });

  it("활성과 후보는 지울 수 없다", () => {
    expect(canDeleteRecipe(makeRecipe("active"))).toBe(false);
    expect(canDeleteRecipe(makeRecipe("candidate"))).toBe(false);
  });
});
