import {describe, expect, it} from "vitest";
import {parseSetTaskTitleArgs} from "~runtime/domain/session/model/set.task.title.tool.model.js";

describe("parseSetTaskTitleArgs", () => {
    it("제목이 있으면 앞뒤 공백을 지우고 읽는다", () => {
        expect(parseSetTaskTitleArgs({title: "  로그인 흐름 리팩터링  "})).toEqual({title: "로그인 흐름 리팩터링"});
    });

    it("제목이 없거나 비어 있으면 거부한다", () => {
        expect(parseSetTaskTitleArgs({})).toBeNull();
        expect(parseSetTaskTitleArgs({title: "   "})).toBeNull();
        expect(parseSetTaskTitleArgs({title: 1})).toBeNull();
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseSetTaskTitleArgs(null)).toBeNull();
    });
});
