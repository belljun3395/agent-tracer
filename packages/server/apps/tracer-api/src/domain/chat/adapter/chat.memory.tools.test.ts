import { describe, expect, it } from "vitest";
import { CHAT_TOOL } from "@monitor/kernel";
import { ChatUserMemoryEntity } from "@monitor/tracer-domain";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import type { ChatMemoryUpdate, ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { buildChatMemoryToolHandlers } from "./chat.memory.tools.js";

const NOW = new Date("2026-03-03T00:00:00.000Z");

function collectingSink(): { sink: ChatTurnSink; updates: ChatMemoryUpdate[] } {
    const updates: ChatMemoryUpdate[] = [];
    return {
        updates,
        sink: {
            onAssistantDelta: () => {},
            onToolCall: () => {},
            onToolResult: () => {},
            onMemoryUpdated: (update) => {
                updates.push(update);
            },
        },
    };
}

describe("buildChatMemoryToolHandlers", () => {
    it("두 도구에 핸들러를 만든다", () => {
        const memories = new InMemoryChatUserMemoryRepository();
        const { sink } = collectingSink();
        const handlers = buildChatMemoryToolHandlers({ userId: "u1", sink }, { memories, clock: new FixedClock(NOW) });
        expect(new Set(Object.keys(handlers))).toEqual(new Set([CHAT_TOOL.recallFacts, CHAT_TOOL.rememberFact]));
    });

    it("recall_facts는 사용자의 저장된 사실을 돌려준다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        memories.seed(ChatUserMemoryEntity.create({ id: "m1", userId: "u1", key: "tone", content: "간결하게", now: NOW }));
        memories.seed(ChatUserMemoryEntity.create({ id: "m2", userId: "other", key: "tone", content: "남의 것", now: NOW }));
        const { sink } = collectingSink();
        const handlers = buildChatMemoryToolHandlers({ userId: "u1", sink }, { memories, clock: new FixedClock(NOW) });

        const raw = await handlers[CHAT_TOOL.recallFacts]!({});
        const result = JSON.parse(raw) as { facts: { key: string; content: string }[] };

        expect(result.facts).toEqual([{ key: "tone", content: "간결하게", updatedAt: NOW.toISOString() }]);
    });

    it("remember_fact는 즉시 upsert하고 갱신을 흘리며 확인 결과를 낸다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        const { sink, updates } = collectingSink();
        const handlers = buildChatMemoryToolHandlers({ userId: "u1", sink }, { memories, clock: new FixedClock(NOW) });

        const raw = await handlers[CHAT_TOOL.rememberFact]!({ key: "tone", content: "간결하게" });
        const result = JSON.parse(raw) as { key: string; content: string; status: string };

        expect(result).toEqual({ key: "tone", content: "간결하게", status: "remembered" });
        // 확인 게이트가 아니라 즉시 적재라, 대기 없이 저장소에 바로 남고 투명성 통지가 흘러나간다.
        expect(await memories.listByUser("u1")).toHaveLength(1);
        expect(updates).toEqual([{ key: "tone", content: "간결하게" }]);
    });

    it("같은 key를 다시 기억하면 내용을 덮어쓴다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        const { sink } = collectingSink();
        const handlers = buildChatMemoryToolHandlers({ userId: "u1", sink }, { memories, clock: new FixedClock(NOW) });

        await handlers[CHAT_TOOL.rememberFact]!({ key: "tone", content: "간결하게" });
        await handlers[CHAT_TOOL.rememberFact]!({ key: "tone", content: "자세하게" });

        const rows = await memories.listByUser("u1");
        expect(rows).toHaveLength(1);
        expect(rows[0]?.content).toBe("자세하게");
    });
});
