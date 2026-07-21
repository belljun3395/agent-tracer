import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "./chat.const.js";
import { ChatMessageEntity } from "./chat.message.entity.js";

const NOW = new Date("2026-07-21T00:00:00.000Z");

describe("ChatMessageEntity", () => {
    describe("create", () => {
        it("toolCalls를 넘기지 않으면 null로 세운다", () => {
            const message = ChatMessageEntity.create({
                id: "m1",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.user,
                content: "안녕",
                now: NOW,
            });

            expect(message.toolCalls).toBeNull();
            expect(message.toolCallId).toBeNull();
        });

        it("빈 toolCalls 배열도 null로 정규화한다", () => {
            const message = ChatMessageEntity.create({
                id: "m1",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.assistant,
                content: "",
                toolCalls: [],
                now: NOW,
            });

            expect(message.toolCalls).toBeNull();
        });

        it("도구 호출이 있으면 그대로 보관한다", () => {
            const toolCalls = [{ id: "call-1", name: "search_memos", args: { query: "배포" } }];
            const message = ChatMessageEntity.create({
                id: "m1",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.assistant,
                content: "찾아볼게요",
                toolCalls,
                now: NOW,
            });

            expect(message.toolCalls).toEqual(toolCalls);
        });

        it("도구 결과 메시지는 toolCallId를 보관한다", () => {
            const message = ChatMessageEntity.create({
                id: "m2",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.tool,
                content: "결과",
                toolCallId: "call-1",
                now: NOW,
            });

            expect(message.toolCallId).toBe("call-1");
        });
    });

    describe("isFromTool / proposesToolCall", () => {
        it("role이 tool이면 isFromTool이 true다", () => {
            const message = ChatMessageEntity.create({
                id: "m1",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.tool,
                content: "결과",
                toolCallId: "call-1",
                now: NOW,
            });
            expect(message.isFromTool()).toBe(true);
        });

        it("도구 호출을 제안한 어시스턴트 메시지만 proposesToolCall이 true다", () => {
            const withCall = ChatMessageEntity.create({
                id: "m1",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.assistant,
                content: "",
                toolCalls: [{ id: "call-1", name: "search_memos", args: {} }],
                now: NOW,
            });
            const withoutCall = ChatMessageEntity.create({
                id: "m2",
                threadId: "t1",
                role: CHAT_MESSAGE_ROLE.assistant,
                content: "답변",
                now: NOW,
            });

            expect(withCall.proposesToolCall()).toBe(true);
            expect(withoutCall.proposesToolCall()).toBe(false);
        });
    });
});
