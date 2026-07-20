import {describe, expect, it} from "vitest";
import {parseMcpSocketRequest} from "~runtime/daemon/port/mcp.socket.port.js";

describe("parseMcpSocketRequest", () => {
    it("제목과 세션이 있으면 그대로 실어 보낸다", () => {
        expect(parseMcpSocketRequest("set-task-title", {title: "제목", sessionId: "cc-1"}))
            .toEqual({type: "set-task-title", title: "제목", sessionId: "cc-1"});
    });

    it("title이 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("set-task-title", {sessionId: "cc-1"})).toBeNull();
    });

    it("sessionId가 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("set-task-title", {title: "제목"})).toBeNull();
    });

    it("알 수 없는 타입은 null이다", () => {
        expect(parseMcpSocketRequest("recipe-get", {recipeId: "r1"})).toBeNull();
    });
});
