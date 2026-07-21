import { describe, expect, it } from "vitest";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { UpsertUserMemoryUseCase } from "./upsert.user.memory.usecase.js";

describe("UpsertUserMemoryUseCase", () => {
    it("장기기억을 정본에 써넣고 DTO로 돌려준다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        const clock = new FixedClock(new Date("2026-07-21T00:00:00.000Z"));
        const useCase = new UpsertUserMemoryUseCase(memories, clock);

        const dto = await useCase.execute({ userId: "u1", key: "editor", content: "vim" });

        expect(dto).toEqual({ key: "editor", content: "vim", updatedAt: "2026-07-21T00:00:00.000Z" });
        const rows = await memories.listByUser("u1");
        expect(rows.map((row) => [row.key, row.content])).toEqual([["editor", "vim"]]);
    });

    it("같은 키를 다시 기억하면 덮어쓴다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        const clock = new FixedClock(new Date("2026-07-21T00:00:00.000Z"));
        const useCase = new UpsertUserMemoryUseCase(memories, clock);

        await useCase.execute({ userId: "u1", key: "lang", content: "한국어" });
        clock.advance(1000);
        await useCase.execute({ userId: "u1", key: "lang", content: "영어" });

        const rows = await memories.listByUser("u1");
        expect(rows.map((row) => [row.key, row.content])).toEqual([["lang", "영어"]]);
    });
});
