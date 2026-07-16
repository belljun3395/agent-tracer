import {describe, expect, it} from "vitest";
import {parseSearchRecipesArgs} from "~runtime/domain/recipe/model/search.recipes.tool.model.js";

describe("parseSearchRecipesArgs", () => {
    it("query만 있어도 유효한 인자로 읽는다", () => {
        expect(parseSearchRecipesArgs({query: "인증 흐름 고치기"})).toEqual({query: "인증 흐름 고치기"});
    });

    it("limit이 숫자면 함께 읽는다", () => {
        expect(parseSearchRecipesArgs({query: "배포 절차", limit: 5}))
            .toEqual({query: "배포 절차", limit: 5});
    });

    it("query가 없거나 비어 있으면 거부한다", () => {
        expect(parseSearchRecipesArgs({})).toBeNull();
        expect(parseSearchRecipesArgs({query: "   "})).toBeNull();
        expect(parseSearchRecipesArgs({query: 1})).toBeNull();
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseSearchRecipesArgs(null)).toBeNull();
        expect(parseSearchRecipesArgs("query")).toBeNull();
    });
});
