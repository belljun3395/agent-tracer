import {describe, expect, it} from "vitest";
import {parseSearchRecipesArgs} from "~runtime/domain/recipe/model/search.recipes.tool.model.js";

describe("parseSearchRecipesArgs", () => {
    it("query가 있으면 유효한 인자로 읽는다", () => {
        expect(parseSearchRecipesArgs({query: "린트 파이프라인"})).toEqual({query: "린트 파이프라인"});
    });

    it("limit을 함께 넘기면 같이 읽는다", () => {
        expect(parseSearchRecipesArgs({query: "린트", limit: 5})).toEqual({query: "린트", limit: 5});
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
