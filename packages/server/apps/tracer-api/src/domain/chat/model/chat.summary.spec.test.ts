import { describe, expect, it } from "vitest";
import { CHAT_SUMMARY_SPEC, selectMessagesToFold, selectReplayMessages, shouldSummarize } from "./chat.summary.spec.js";

function messagesOf(count: number, contentLength = 1): { readonly content: string }[] {
    return Array.from({ length: count }, () => ({ content: "x".repeat(contentLength) }));
}

describe("shouldSummarize", () => {
    it("메시지 수가 문턱 이하면 압축하지 않는다", () => {
        expect(shouldSummarize(messagesOf(CHAT_SUMMARY_SPEC.triggerMessageCount))).toBe(false);
    });

    it("메시지 수가 문턱을 넘으면 압축한다", () => {
        expect(shouldSummarize(messagesOf(CHAT_SUMMARY_SPEC.triggerMessageCount + 1))).toBe(true);
    });

    it("메시지 수는 적어도 누적 글자 수가 예산을 넘으면 압축한다", () => {
        const messages = messagesOf(3, CHAT_SUMMARY_SPEC.triggerCharBudget);
        expect(shouldSummarize(messages)).toBe(true);
    });
});

describe("selectReplayMessages", () => {
    it("요약이 없으면 전체를 재생한다", () => {
        const messages = messagesOf(30);
        expect(selectReplayMessages(messages, false)).toHaveLength(30);
    });

    it("요약이 있으면 최근 recentKeepCount개만 재생한다", () => {
        const messages = messagesOf(30);
        const replay = selectReplayMessages(messages, true);
        expect(replay).toHaveLength(CHAT_SUMMARY_SPEC.recentKeepCount);
        expect(replay).toEqual(messages.slice(-CHAT_SUMMARY_SPEC.recentKeepCount));
    });
});

describe("selectMessagesToFold", () => {
    it("재생 창 바깥의 오래된 메시지만 접어 넣는다", () => {
        const messages = messagesOf(30);
        const older = selectMessagesToFold(messages);
        expect(older).toHaveLength(30 - CHAT_SUMMARY_SPEC.recentKeepCount);
        expect(older).toEqual(messages.slice(0, 30 - CHAT_SUMMARY_SPEC.recentKeepCount));
    });

    it("메시지가 재생 창보다 적으면 접을 것이 없다", () => {
        const messages = messagesOf(3);
        expect(selectMessagesToFold(messages)).toHaveLength(0);
    });
});
