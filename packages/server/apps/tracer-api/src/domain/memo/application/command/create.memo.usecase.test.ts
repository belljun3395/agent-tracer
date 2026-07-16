import { describe, expect, it } from "vitest";
import { MEMO_AUTHOR } from "@monitor/kernel";
import { SEARCH_OUTBOX_TARGET } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/memo/port/__fakes__/fixed.clock.js";
import { InMemoryMemoTransaction } from "~tracer-api/domain/memo/port/__fakes__/in-memory.memo.transaction.js";
import { CreateMemoUseCase } from "./create.memo.usecase.js";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("CreateMemoUseCase", () => {
    it("태스크 메모를 새로 심고 검색 아웃박스에 반영 요청을 남긴다", async () => {
        const tx = new InMemoryMemoTransaction();
        const useCase = new CreateMemoUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", taskId: "t1", body: "메모", author: MEMO_AUTHOR.human });

        expect(result.memo.taskId).toBe("t1");
        expect(result.memo.eventId).toBeNull();
        expect(result.memo.rev).toBe(1);
        const outboxRows = tx.searchOutbox.all();
        expect(outboxRows).toHaveLength(1);
        expect(outboxRows[0]).toMatchObject({ target: SEARCH_OUTBOX_TARGET.memo, targetId: result.memo.id, userId: "u1" });
    });

    it("eventId가 있으면 이벤트 메모로 심는다", async () => {
        const tx = new InMemoryMemoTransaction();
        const useCase = new CreateMemoUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", taskId: "t1", eventId: "e1", body: "메모", author: MEMO_AUTHOR.agent });

        expect(result.memo.eventId).toBe("e1");
        expect(result.memo.author).toBe(MEMO_AUTHOR.agent);
    });

    it("같은 태스크에 두 번 호출하면 기존 행을 건드리지 않고 새 메모를 더한다", async () => {
        const tx = new InMemoryMemoTransaction();
        const useCase = new CreateMemoUseCase(tx, clock);

        await useCase.execute({ userId: "u1", taskId: "t1", body: "첫 메모", author: MEMO_AUTHOR.human });
        await useCase.execute({ userId: "u1", taskId: "t1", body: "두 번째 메모", author: MEMO_AUTHOR.human });

        expect(tx.memos.all()).toHaveLength(2);
    });
});
