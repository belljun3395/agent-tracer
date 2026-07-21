import { describe, expect, it } from "vitest";
import { ChatUserMemoryEntity } from "./chat.user.memory.entity.js";

const NOW = new Date("2026-07-21T00:00:00.000Z");

describe("ChatUserMemoryEntity", () => {
    describe("create", () => {
        it("createdAt과 updatedAt을 같은 시각으로 시작한다", () => {
            const memory = ChatUserMemoryEntity.create({
                id: "mem1",
                userId: "u1",
                key: "preferred-language",
                content: "한국어로 답한다",
                now: NOW,
            });

            expect(memory.createdAt).toEqual(NOW);
            expect(memory.updatedAt).toEqual(NOW);
        });
    });

    describe("updateContent", () => {
        it("내용을 바꾸고 updatedAt만 민다", () => {
            const memory = ChatUserMemoryEntity.create({
                id: "mem1",
                userId: "u1",
                key: "preferred-language",
                content: "한국어로 답한다",
                now: NOW,
            });
            const updatedAt = new Date("2026-07-21T01:00:00.000Z");

            memory.updateContent("영어로 답한다", updatedAt);

            expect(memory.content).toBe("영어로 답한다");
            expect(memory.updatedAt).toEqual(updatedAt);
            expect(memory.createdAt).toEqual(NOW);
        });
    });
});
