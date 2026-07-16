import {describe, expect, it} from "vitest";
import {parseSetTaskTitleArgs} from "~runtime/domain/session/model/set.task.title.tool.model.js";

describe("parseSetTaskTitleArgs", () => {
    it("제목과 sessionId가 있으면 제목의 앞뒤 공백을 지우고 읽는다", () => {
        expect(parseSetTaskTitleArgs({title: "  로그인 흐름 리팩터링  ", sessionId: "session-1"})).toEqual({
            title: "로그인 흐름 리팩터링",
            sessionId: "session-1",
        });
    });

    it("제목이 없거나 비어 있으면 거부한다", () => {
        expect(parseSetTaskTitleArgs({sessionId: "session-1"})).toBeNull();
        expect(parseSetTaskTitleArgs({title: "   ", sessionId: "session-1"})).toBeNull();
        expect(parseSetTaskTitleArgs({title: 1, sessionId: "session-1"})).toBeNull();
    });

    it("sessionId가 없거나 비어 있으면 거부한다", () => {
        expect(parseSetTaskTitleArgs({title: "로그인 흐름 리팩터링"})).toBeNull();
        expect(parseSetTaskTitleArgs({title: "로그인 흐름 리팩터링", sessionId: "   "})).toBeNull();
        expect(parseSetTaskTitleArgs({title: "로그인 흐름 리팩터링", sessionId: 1})).toBeNull();
    });

    it("객체가 아니면 거부한다", () => {
        expect(parseSetTaskTitleArgs(null)).toBeNull();
    });
});
