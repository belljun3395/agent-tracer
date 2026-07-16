import { describe, expect, it } from "vitest";
import { MEMO_AUTHOR } from "@monitor/kernel";
import { MemoEntity } from "@monitor/tracer-domain";
import { InMemoryMemoRepository } from "~tracer-api/domain/memo/port/__fakes__/in-memory.memo.repository.js";
import { ListMemosUseCase } from "./list.memos.usecase.js";

function memo(id: string, userId: string, taskId: string, eventId: string | null): MemoEntity {
    return MemoEntity.create({
        id,
        userId,
        taskId,
        eventId,
        body: `메모 ${id}`,
        author: MEMO_AUTHOR.human,
        now: new Date("2026-01-01T00:00:00.000Z"),
    });
}

describe("ListMemosUseCase", () => {
    it("이 사용자의 태스크·이벤트 메모를 모두 준다", async () => {
        const repo = new InMemoryMemoRepository();
        repo.seed(memo("m1", "u1", "t1", null), memo("m2", "u1", "t2", "e1"), memo("m3", "u2", "t1", null));
        const useCase = new ListMemosUseCase(repo);

        const result = await useCase.execute("u1");

        expect(result.items.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    });
});
