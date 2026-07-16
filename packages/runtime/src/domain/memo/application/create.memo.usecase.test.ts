import {describe, expect, it} from "vitest";
import {CreateMemoUsecase} from "~runtime/domain/memo/application/create.memo.usecase.js";
import {InMemoryMemoWrite} from "~runtime/domain/memo/port/__fakes__/in-memory.memo.write.js";

describe("CreateMemoUsecase", () => {
    it("taskId와 body가 있으면 그대로 심는다", async () => {
        const writer = new InMemoryMemoWrite();
        const usecase = new CreateMemoUsecase(writer);

        const ok = await usecase.execute({taskId: "t1", body: "메모", eventId: "e1"});

        expect(ok).toBe(true);
        expect(writer.created).toEqual([{taskId: "t1", body: "메모", eventId: "e1"}]);
    });

    it("taskId나 body가 비어 있으면 심지 않는다", async () => {
        const writer = new InMemoryMemoWrite();
        const usecase = new CreateMemoUsecase(writer);

        expect(await usecase.execute({taskId: "", body: "메모"})).toBe(false);
        expect(await usecase.execute({taskId: "t1", body: "   "})).toBe(false);
        expect(writer.created).toEqual([]);
    });

    it("서버 쓰기가 실패해도 예외를 삼키고 false를 낸다", async () => {
        const writer = new InMemoryMemoWrite();
        writer.failNext();
        const usecase = new CreateMemoUsecase(writer);

        expect(await usecase.execute({taskId: "t1", body: "메모"})).toBe(false);
    });
});
