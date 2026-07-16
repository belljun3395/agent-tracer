import {describe, expect, it} from "vitest";
import {parseCreateMemoArgs} from "~runtime/domain/memo/model/create.memo.tool.model.js";

describe("parseCreateMemoArgs", () => {
    it("body만 있어도 유효한 인자로 읽는다", () => {
        expect(parseCreateMemoArgs({body: "메모"})).toEqual({body: "메모"});
    });

    it("eventId가 문자열이면 함께 읽는다", () => {
        expect(parseCreateMemoArgs({body: "메모", eventId: "e1"})).toEqual({body: "메모", eventId: "e1"});
    });

    it("body가 없거나 빈 문자열이면 거부한다", () => {
        expect(parseCreateMemoArgs({})).toBeNull();
        expect(parseCreateMemoArgs({body: "   "})).toBeNull();
        expect(parseCreateMemoArgs({body: 1})).toBeNull();
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseCreateMemoArgs(null)).toBeNull();
        expect(parseCreateMemoArgs("body")).toBeNull();
    });
});
