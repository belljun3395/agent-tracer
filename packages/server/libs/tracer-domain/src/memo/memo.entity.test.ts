import { describe, expect, it } from "vitest";
import { MEMO_AUTHOR } from "@monitor/kernel";
import { MemoEntity } from "./memo.entity.js";

const NOW = new Date("2026-07-16T00:00:00.000Z");

function makeMemo(): MemoEntity {
    return MemoEntity.create({
        id: "memo-1",
        userId: "u1",
        taskId: "t1",
        eventId: null,
        body: "메모",
        author: MEMO_AUTHOR.agent,
        now: NOW,
    });
}

describe("MemoEntity", () => {
    describe("create", () => {
        it("작성자를 최초 편집자로 세우고 rev를 1로 시작한다", () => {
            const memo = makeMemo();
            expect(memo.rev).toBe(1);
            expect(memo.lastEditedBy).toBe(MEMO_AUTHOR.agent);
            expect(memo.deletedAt).toBeNull();
        });
    });

    describe("markEditedByUser", () => {
        it("rev를 올리고 마지막 편집자를 사람으로 세운다", () => {
            const memo = makeMemo();
            const editedAt = new Date("2026-07-16T01:00:00.000Z");

            memo.markEditedByUser(editedAt);

            expect(memo.rev).toBe(2);
            expect(memo.lastEditedBy).toBe(MEMO_AUTHOR.human);
            expect(memo.updatedAt).toEqual(editedAt);
        });
    });

    describe("softDelete / isDeleted", () => {
        it("softDelete 이후 isDeleted는 true를 반환한다", () => {
            const memo = makeMemo();
            expect(memo.isDeleted()).toBe(false);

            memo.softDelete(new Date("2026-07-16T02:00:00.000Z"));

            expect(memo.isDeleted()).toBe(true);
        });
    });
});
