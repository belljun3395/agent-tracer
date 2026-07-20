import {describe, expect, it} from "vitest";
import {parseMcpSocketRequest} from "~runtime/daemon/port/mcp.socket.port.js";

describe("parseMcpSocketRequest", () => {
    it("메모 쓰기는 sessionId가 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("memo-create", {body: "note"})).toBeNull();
    });

    it("메모 조회는 sessionId가 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("memo-search", {query: "note"})).toBeNull();
    });

    it("레시피 성과 보고는 sessionId가 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("recipe-outcome", {recipeId: "r1", outcome: "completed"})).toBeNull();
    });

    it("레시피 스캔 요청은 sessionId가 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("recipe-scan-request", {})).toBeNull();
    });

    it("sessionId가 있으면 그대로 실어 보낸다", () => {
        expect(parseMcpSocketRequest("memo-create", {body: "note", sessionId: "cc-1"}))
            .toEqual({type: "memo-create", body: "note", sessionId: "cc-1"});
        expect(parseMcpSocketRequest("memo-search", {sessionId: "cc-1", limit: 5}))
            .toEqual({type: "memo-search", sessionId: "cc-1", limit: 5});
        expect(parseMcpSocketRequest("recipe-scan-request", {sessionId: "cc-1"}))
            .toEqual({type: "recipe-scan-request", sessionId: "cc-1"});
        expect(parseMcpSocketRequest("recipe-outcome", {recipeId: "r1", outcome: "completed", sessionId: "cc-1"}))
            .toEqual({type: "recipe-outcome", recipeId: "r1", outcome: "completed", sessionId: "cc-1"});
    });

    it("레시피 본문 조회는 sessionId가 없어도 본문을 내주고 적용 이력만 포기한다", () => {
        expect(parseMcpSocketRequest("recipe-get", {recipeId: "r1"}))
            .toEqual({type: "recipe-get", recipeId: "r1"});
        expect(parseMcpSocketRequest("recipe-get", {recipeId: "r1", sessionId: "cc-1"}))
            .toEqual({type: "recipe-get", recipeId: "r1", sessionId: "cc-1"});
    });

    it("레시피 검색은 태스크에 귀속되지 않아 sessionId 없이도 통과한다", () => {
        expect(parseMcpSocketRequest("recipe-search", {query: "린트"}))
            .toEqual({type: "recipe-search", query: "린트"});
        expect(parseMcpSocketRequest("recipe-search", {query: "린트", limit: 5}))
            .toEqual({type: "recipe-search", query: "린트", limit: 5});
    });

    it("레시피 검색은 query가 없으면 거절한다", () => {
        expect(parseMcpSocketRequest("recipe-search", {})).toBeNull();
    });
});
