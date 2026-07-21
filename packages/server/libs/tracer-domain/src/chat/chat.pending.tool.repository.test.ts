import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { CHAT_PENDING_TOOL_STATUS } from "./chat.const.js";
import { ChatPendingToolEntity } from "./chat.pending.tool.entity.js";
import { ChatPendingToolRepository } from "./chat.pending.tool.repository.js";

function pendingTool(id: string, threadId: string, now: Date): ChatPendingToolEntity {
    return ChatPendingToolEntity.create({ id, threadId, messageId: null, toolName: "delete_task", args: {}, now });
}

describe("ChatPendingToolRepository", () => {
    it("생성한 대기 도구를 id로 조회할 수 있다", async () => {
        const store = createInMemoryRepository<ChatPendingToolEntity>();
        const repo = new ChatPendingToolRepository(asRepository(store));
        const created = pendingTool("pt1", "t1", new Date("2026-07-21T00:00:00.000Z"));

        await repo.create(created);

        expect(await repo.findById("pt1")).toEqual(created);
    });

    it("스레드별 조회는 상태로 걸러낼 수 있다", async () => {
        const store = createInMemoryRepository<ChatPendingToolEntity>();
        const approved = pendingTool("pt1", "t1", new Date("2026-07-21T00:00:00.000Z"));
        approved.approve(new Date("2026-07-21T01:00:00.000Z"));
        store.seed(approved, pendingTool("pt2", "t1", new Date("2026-07-21T00:00:00.000Z")), pendingTool("pt3", "t2", new Date("2026-07-21T00:00:00.000Z")));
        const repo = new ChatPendingToolRepository(asRepository(store));

        const pending = await repo.listByThread("t1", CHAT_PENDING_TOOL_STATUS.pending);

        expect(pending.map((p) => p.id)).toEqual(["pt2"]);
    });

    it("resolve는 전이된 상태를 반영한다", async () => {
        const store = createInMemoryRepository<ChatPendingToolEntity>();
        const created = pendingTool("pt1", "t1", new Date("2026-07-21T00:00:00.000Z"));
        store.seed(created);
        const repo = new ChatPendingToolRepository(asRepository(store));

        created.reject(new Date("2026-07-21T01:00:00.000Z"));
        await repo.resolve(created);

        const found = await repo.findById("pt1");
        expect(found?.status).toBe(CHAT_PENDING_TOOL_STATUS.rejected);
    });

    it("deleteByThread는 그 스레드의 대기 도구만 지운다", async () => {
        const store = createInMemoryRepository<ChatPendingToolEntity>();
        store.seed(
            pendingTool("pt1", "t1", new Date("2026-07-21T00:00:00.000Z")),
            pendingTool("pt2", "t2", new Date("2026-07-21T00:00:00.000Z")),
        );
        const repo = new ChatPendingToolRepository(asRepository(store));

        await repo.deleteByThread("t1");

        expect(await repo.findById("pt1")).toBeNull();
        expect(await repo.findById("pt2")).not.toBeNull();
    });
});
