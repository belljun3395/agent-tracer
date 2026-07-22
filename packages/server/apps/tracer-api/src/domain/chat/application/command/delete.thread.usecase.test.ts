import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ChatMessageEntity, ChatPendingToolEntity, ChatThreadEntity, CHAT_MESSAGE_ROLE } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { DeleteThreadUseCase } from "./delete.thread.usecase.js";
import { inMemoryChatTransaction } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.transaction.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function seed(threads: InMemoryChatThreadRepository, messages: InMemoryChatMessageRepository, pendingTools: InMemoryChatPendingToolRepository): void {
    threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: NOW }));
    messages.seed(ChatMessageEntity.create({ id: "m1", threadId: "th1", role: CHAT_MESSAGE_ROLE.user, content: "질문", now: NOW }));
    pendingTools.seed(
        ChatPendingToolEntity.create({ id: "pt1", threadId: "th1", messageId: null, toolName: "delete_task", args: {}, now: NOW }),
    );
}

describe("DeleteThreadUseCase", () => {
    function build(threads: InMemoryChatThreadRepository, messages: InMemoryChatMessageRepository, pendingTools: InMemoryChatPendingToolRepository) {
        const executions = new InMemoryChatExecutionRepository();
        const dispatcher = { start: async () => undefined, cancel: async () => undefined };
        return new DeleteThreadUseCase(
            threads,
            executions,
            dispatcher,
            inMemoryChatTransaction({ threads, messages, pendingTools, executions }),
        );
    }

    it("소유한 스레드를 메시지와 대기 도구까지 캐스케이드로 지운다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        const pendingTools = new InMemoryChatPendingToolRepository();
        seed(threads, messages, pendingTools);
        const useCase = build(threads, messages, pendingTools);

        const result = await useCase.execute("u1", "th1");

        expect(result.deleted).toBe(true);
        expect(await threads.findById("th1")).toBeNull();
        expect(await messages.listByThread("th1")).toHaveLength(0);
        expect(await pendingTools.findById("pt1")).toBeNull();
    });

    it("남의 스레드는 지우지 못한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        const pendingTools = new InMemoryChatPendingToolRepository();
        seed(threads, messages, pendingTools);
        const useCase = build(threads, messages, pendingTools);

        await expect(useCase.execute("u2", "th1")).rejects.toBeInstanceOf(NotFoundException);
        expect(await threads.findById("th1")).not.toBeNull();
    });

    it("존재하지 않는 스레드는 찾지 못한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        const pendingTools = new InMemoryChatPendingToolRepository();
        const useCase = build(threads, messages, pendingTools);

        await expect(useCase.execute("u1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
});
