import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { MEMO_AUTHOR } from "@monitor/kernel";
import { MemoEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/memo/port/__fakes__/fixed.clock.js";
import { InMemoryMemoTransaction } from "~tracer-api/domain/memo/port/__fakes__/in-memory.memo.transaction.js";
import { DeleteMemoUseCase } from "./delete.memo.usecase.js";

const clock = new FixedClock(new Date("2026-01-02T00:00:00.000Z"));

function memo(overrides: Partial<MemoEntity> = {}): MemoEntity {
    const entity = MemoEntity.create({
        id: "m1",
        userId: "u1",
        taskId: "t1",
        eventId: null,
        body: "메모",
        author: MEMO_AUTHOR.human,
        now: new Date("2026-01-01T00:00:00.000Z"),
    });
    Object.assign(entity, overrides);
    return entity;
}

describe("DeleteMemoUseCase", () => {
    it("자기 메모를 소프트삭제하고 검색 아웃박스에 반영 요청을 남긴다", async () => {
        const tx = new InMemoryMemoTransaction();
        tx.memos.seed(memo());
        const useCase = new DeleteMemoUseCase(tx, clock);

        const result = await useCase.execute("u1", "m1");

        expect(result.deleted).toBe(true);
        const stored = await tx.memos.findById("m1");
        expect(stored?.isDeleted()).toBe(true);
        expect(tx.searchOutbox.all()).toHaveLength(1);
    });

    it("남의 메모는 찾을 수 없다고 응답한다", async () => {
        const tx = new InMemoryMemoTransaction();
        tx.memos.seed(memo({ userId: "u2" }));
        const useCase = new DeleteMemoUseCase(tx, clock);

        await expect(useCase.execute("u1", "m1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("이미 삭제된 메모를 다시 지우려 하면 찾을 수 없다고 응답한다", async () => {
        const deleted = memo();
        deleted.softDelete(new Date("2026-01-01T01:00:00.000Z"));
        const tx = new InMemoryMemoTransaction();
        tx.memos.seed(deleted);
        const useCase = new DeleteMemoUseCase(tx, clock);

        await expect(useCase.execute("u1", "m1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
