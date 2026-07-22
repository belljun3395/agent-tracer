import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { ChatExecutionEntity } from "./chat.execution.entity.js";
import { ChatExecutionRepository } from "./chat.execution.repository.js";

function execution(id: string, threadId: string, createdAt: Date): ChatExecutionEntity {
    const row = ChatExecutionEntity.create({
        userId: "u1",
        threadId,
        userMessageId: `message-${id}`,
        clientRequestId: `request-${id}`,
        inputHash: `hash-${id}`,
        requestedBackend: null,
        model: null,
        language: null,
        now: createdAt,
    });
    row.id = id;
    return row;
}

describe("ChatExecutionRepository", () => {
    it("스레드의 가장 최신 대기·실행 중 상태를 복구한다", async () => {
        const store = createInMemoryRepository<ChatExecutionEntity>();
        const old = execution("e1", "t1", new Date("2026-07-22T00:00:00.000Z"));
        old.start(new Date("2026-07-22T00:00:01.000Z"));
        old.complete("a1", new Date("2026-07-22T00:00:02.000Z"));
        const queued = execution("e2", "t1", new Date("2026-07-22T00:00:03.000Z"));
        const other = execution("e3", "t2", new Date("2026-07-22T00:00:04.000Z"));
        store.seed(old, queued, other);
        const repository = new ChatExecutionRepository(asRepository(store));

        expect((await repository.findLatestActiveByThread("t1"))?.id).toBe("e2");
    });

    it("대기 실행을 접수 순서대로 조회한다", async () => {
        const store = createInMemoryRepository<ChatExecutionEntity>();
        store.seed(
            execution("e2", "t1", new Date("2026-07-22T00:00:02.000Z")),
            execution("e1", "t1", new Date("2026-07-22T00:00:01.000Z")),
            execution("e3", "t2", new Date("2026-07-22T00:00:00.000Z")),
        );
        const repository = new ChatExecutionRepository(asRepository(store));

        expect((await repository.listQueuedByThread("t1")).map((row) => row.id)).toEqual([
            "e1",
            "e2",
        ]);
    });
});
