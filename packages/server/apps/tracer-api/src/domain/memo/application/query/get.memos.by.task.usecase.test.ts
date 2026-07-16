import { describe, expect, it } from "vitest";
import { MEMO_AUTHOR } from "@monitor/kernel";
import { MemoEntity } from "@monitor/tracer-domain";
import { InMemoryMemoRepository } from "~tracer-api/domain/memo/port/__fakes__/in-memory.memo.repository.js";
import { GetMemosByTaskUseCase } from "./get.memos.by.task.usecase.js";

function memo(id: string, taskId: string, eventId: string | null): MemoEntity {
    return MemoEntity.create({
        id,
        userId: "u1",
        taskId,
        eventId,
        body: `메모 ${id}`,
        author: MEMO_AUTHOR.human,
        now: new Date("2026-01-01T00:00:00.000Z"),
    });
}

describe("GetMemosByTaskUseCase", () => {
    it("eventId가 없으면 태스크 메모만 준다", async () => {
        const repo = new InMemoryMemoRepository();
        repo.seed(memo("m1", "t1", null), memo("m2", "t1", "e1"));
        const useCase = new GetMemosByTaskUseCase(repo);

        const result = await useCase.execute("u1", "t1");

        expect(result.items.map((m) => m.id)).toEqual(["m1"]);
    });

    it("eventId가 있으면 그 이벤트 메모만 준다", async () => {
        const repo = new InMemoryMemoRepository();
        repo.seed(memo("m1", "t1", null), memo("m2", "t1", "e1"), memo("m3", "t2", "e1"));
        const useCase = new GetMemosByTaskUseCase(repo);

        const result = await useCase.execute("u1", "t1", "e1");

        expect(result.items.map((m) => m.id)).toEqual(["m2"]);
    });
});
