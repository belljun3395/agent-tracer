import {describe, expect, it} from "vitest";
import {parseSetTaskTitleArgs} from "~runtime/domain/session/model/set.task.title.tool.model.js";

describe("parseSetTaskTitleArgs", () => {
    it("제목의 앞뒤 공백을 지우고 읽는다", () => {
        expect(parseSetTaskTitleArgs({title: "  로그인 흐름 리팩터링  "})).toEqual({
            title: "로그인 흐름 리팩터링",
        });
    });

    it("세션 식별자는 서버가 스스로 알므로 인자로 받지 않는다", () => {
        expect(parseSetTaskTitleArgs({title: "로그인 흐름 리팩터링", sessionId: "session-1"})).toEqual({
            title: "로그인 흐름 리팩터링",
        });
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
