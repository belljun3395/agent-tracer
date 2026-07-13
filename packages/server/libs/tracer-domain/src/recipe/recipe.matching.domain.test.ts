import { describe, expect, it } from "vitest";
import { RecipeEntity } from "./recipe.entity.js";
import { RecipeMatching } from "./recipe.matching.domain.js";
import type { RecipeCandidateInput } from "./recipe.types.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRecipe(overrides: Partial<RecipeCandidateInput> & { readonly active?: boolean } = {}): RecipeEntity {
    const { active = true, ...inputOverrides } = overrides;
    const input: RecipeCandidateInput = {
        id: overrides.id ?? "r1",
        userId: "u1",
        title: "database migration",
        intent: "migrate the database schema",
        description: "how to run a database migration safely",
        summaryMd: "",
        request: "사용자가 데이터베이스 마이그레이션 절차를 요청했다.",
        corrections: [],
        pitfalls: [],
        governingRules: [],
        steps: [],
        touchedFiles: [],
        contributingSlices: [],
        ...inputOverrides,
    };
    const recipe = RecipeEntity.candidate(input, NOW);
    if (active) recipe.accept(NOW);
    return recipe;
}

describe("RecipeMatching", () => {
    it("활성이 아닌 레시피는 후보에서 제외한다", () => {
        const matching = new RecipeMatching([makeRecipe({ active: false })]);
        expect(matching.match("run a database migration", 3)).toEqual([]);
    });

    it("토큰이 하나도 겹치지 않는 레시피는 제외한다", () => {
        const recipe = makeRecipe({
            id: "r2",
            title: "frontend styling",
            intent: "css layout",
            description: "css and layout tips",
        });
        const matching = new RecipeMatching([recipe]);
        expect(matching.match("run a database migration", 3)).toEqual([]);
    });

    it("겹치는 토큰이 있으면 매칭 결과에 recipeId와 양수 score를 포함한다", () => {
        const matching = new RecipeMatching([makeRecipe()]);
        const result = matching.match("please help me run a database migration", 3);
        expect(result).toHaveLength(1);
        expect(result[0]!.recipeId).toBe("r1");
        expect(result[0]!.score).toBeGreaterThan(0);
    });

    it("점수 내림차순으로 정렬하고 limit을 지킨다", () => {
        const recipes = [
            makeRecipe({ id: "a", title: "kafka consumer offset lag", intent: "kafka", description: "kafka consumer offset lag debugging" }),
            makeRecipe({ id: "b", title: "kafka consumer", intent: "kafka", description: "kafka consumer basics" }),
            makeRecipe({ id: "c", title: "kafka", intent: "kafka", description: "kafka intro" }),
        ];
        const matching = new RecipeMatching(recipes);
        const result = matching.match("debug kafka consumer offset lag", 2);
        expect(result).toHaveLength(2);
        expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score);
    });

    it("프롬프트가 불용어뿐이면 빈 배열을 반환한다", () => {
        const matching = new RecipeMatching([makeRecipe()]);
        expect(matching.match("the and for", 3)).toEqual([]);
    });
});
