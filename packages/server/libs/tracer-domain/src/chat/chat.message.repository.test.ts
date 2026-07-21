import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { CHAT_MESSAGE_ROLE } from "./chat.const.js";
import { ChatMessageEntity } from "./chat.message.entity.js";
import { ChatMessageRepository } from "./chat.message.repository.js";

function message(id: string, threadId: string, createdAt: Date): ChatMessageEntity {
    return ChatMessageEntity.create({ id, threadId, role: CHAT_MESSAGE_ROLE.user, content: `메시지 ${id}`, now: createdAt });
}

describe("ChatMessageRepository", () => {
    it("스레드 조회는 그 스레드의 메시지만, 쌓인 순서대로 준다", async () => {
        const store = createInMemoryRepository<ChatMessageEntity>();
        store.seed(
            message("m2", "t1", new Date("2026-07-21T01:00:00.000Z")),
            message("m1", "t1", new Date("2026-07-21T00:00:00.000Z")),
            message("m3", "t2", new Date("2026-07-21T02:00:00.000Z")),
        );
        const repo = new ChatMessageRepository(asRepository(store));

        const found = await repo.listByThread("t1");

        expect(found.map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    it("append로 저장한 메시지가 조회에 나타난다", async () => {
        const store = createInMemoryRepository<ChatMessageEntity>();
        const repo = new ChatMessageRepository(asRepository(store));
        const appended = message("m1", "t1", new Date("2026-07-21T00:00:00.000Z"));

        await repo.append(appended);

        expect((await repo.listByThread("t1")).map((m) => m.id)).toEqual(["m1"]);
    });
});
