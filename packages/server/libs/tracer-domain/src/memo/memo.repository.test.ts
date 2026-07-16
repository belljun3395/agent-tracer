import { describe, expect, it } from "vitest";
import { MEMO_AUTHOR } from "@monitor/kernel";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { MemoEntity } from "./memo.entity.js";
import { MemoRepository } from "./memo.repository.js";

function memo(id: string, taskId: string, eventId: string | null): MemoEntity {
    return MemoEntity.create({
        id,
        userId: "u1",
        taskId,
        eventId,
        body: `메모 ${id}`,
        author: MEMO_AUTHOR.human,
        now: new Date("2026-07-16T00:00:00.000Z"),
    });
}

describe("MemoRepository", () => {
    it("태스크 조회는 태스크 메모와 이벤트 메모를 모두 포함한다", async () => {
        const store = createInMemoryRepository<MemoEntity>();
        store.seed(memo("m1", "t1", null), memo("m2", "t1", "e1"), memo("m3", "t2", null));
        const repo = new MemoRepository(asRepository(store));

        const found = await repo.findByTask("u1", "t1");

        expect(found.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    });

    it("이벤트 조회는 그 이벤트에 매달린 메모만 준다", async () => {
        const store = createInMemoryRepository<MemoEntity>();
        store.seed(memo("m1", "t1", null), memo("m2", "t1", "e1"), memo("m3", "t2", "e1"));
        const repo = new MemoRepository(asRepository(store));

        const found = await repo.findByEvent("e1");

        expect(found.map((m) => m.id).sort()).toEqual(["m2", "m3"]);
    });

    it("소프트삭제된 메모는 조회에서 제외된다", async () => {
        const store = createInMemoryRepository<MemoEntity>();
        const deleted = memo("m1", "t1", null);
        deleted.softDelete(new Date("2026-07-16T01:00:00.000Z"));
        store.seed(deleted, memo("m2", "t1", null));
        const repo = new MemoRepository(asRepository(store));

        const found = await repo.findByTask("u1", "t1");

        expect(found.map((m) => m.id)).toEqual(["m2"]);
    });
});
