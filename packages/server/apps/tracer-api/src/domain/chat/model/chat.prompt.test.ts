import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "@monitor/tracer-domain";
import { renderChatPrompt } from "./chat.prompt.js";
import type { ChatTurnMessage } from "./chat.turn.model.js";

const MESSAGES: readonly ChatTurnMessage[] = [{ role: CHAT_MESSAGE_ROLE.user, content: "안녕" }];

describe("renderChatPrompt 장기기억 주입", () => {
    it("사실이 있으면 프롬프트 맨 앞에 유저 사실 절을 세운다", () => {
        const prompt = renderChatPrompt(MESSAGES, null, [
            { key: "tone", content: "간결하게" },
            { key: "stack", content: "TypeScript" },
        ]);
        expect(prompt.startsWith("Durable facts you know about this user:")).toBe(true);
        expect(prompt).toContain("- tone: 간결하게");
        expect(prompt).toContain("- stack: TypeScript");
    });

    it("사실이 없으면 프롬프트는 그대로다", () => {
        const withEmpty = renderChatPrompt(MESSAGES, null, []);
        const withNone = renderChatPrompt(MESSAGES, null);
        expect(withEmpty).toBe(withNone);
        expect(withEmpty).not.toContain("Durable facts");
    });
});
