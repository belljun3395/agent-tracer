import {describe, expect, it} from "vitest";
import {parseSearchMemosArgs} from "~runtime/domain/memo/model/search.memos.tool.model.js";

describe("parseSearchMemosArgs", () => {
    it("빈 객체도 유효한 인자로 읽는다", () => {
        expect(parseSearchMemosArgs({})).toEqual({});
    });

    it("query와 limit이 있으면 함께 읽는다", () => {
        expect(parseSearchMemosArgs({query: "배포", limit: 5})).toEqual({query: "배포", limit: 5});
    });

    it("빈 query는 버리고 없는 것으로 읽는다", () => {
        expect(parseSearchMemosArgs({query: "   "})).toEqual({});
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseSearchMemosArgs(null)).toBeNull();
        expect(parseSearchMemosArgs("query")).toBeNull();
    });
});
