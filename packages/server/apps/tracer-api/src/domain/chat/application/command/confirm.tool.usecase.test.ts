import { describe, expect, it } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CHAT_TOOL } from "@monitor/kernel";
import { ChatPendingToolEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import type { ChatToolExecutorRegistry } from "~tracer-api/domain/chat/port/chat.tool.executors.port.js";
import { CHAT_CONFIRM_DECISION, ConfirmToolUseCase } from "./confirm.tool.usecase.js";

const NOW = new Date("2026-03-03T00:00:00.000Z");

function build(executors: ChatToolExecutorRegistry) {
    const threads = new InMemoryChatThreadRepository();
    const messages = new InMemoryChatMessageRepository();
    const pendingTools = new InMemoryChatPendingToolRepository();
    threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-03-01T00:00:00.000Z") }));
    pendingTools.seed(
        ChatPendingToolEntity.create({
            id: "c1",
            threadId: "th1",
            messageId: null,
            toolName: CHAT_TOOL.archiveTask,
            args: { taskId: "t1" },
            now: new Date("2026-03-02T00:00:00.000Z"),
        }),
    );
    const useCase = new ConfirmToolUseCase(threads, messages, pendingTools, executors, new FixedClock(NOW));
    return { useCase, messages, pendingTools };
}

const okExecutors: ChatToolExecutorRegistry = {
    [CHAT_TOOL.archiveTask]: (userId, args) => Promise.resolve(`archived ${String(args["taskId"])} for ${userId}`),
};

describe("ConfirmToolUseCase", () => {
    it("승인하면 실행자를 호출하고 결과를 tool 메시지로 남기며 대기 행을 approved로 전이한다", async () => {
        const { useCase, messages, pendingTools } = build(okExecutors);

        const result = await useCase.execute({ userId: "u1", threadId: "th1", confirmationId: "c1", decision: CHAT_CONFIRM_DECISION.approve });

        expect(result.status).toBe("approved");
        expect(result.result).toBe("archived t1 for u1");
        expect((await pendingTools.findById("c1"))?.status).toBe("approved");
        const rows = await messages.listByThread("th1");
        expect(rows).toHaveLength(1);
        expect(rows[0]?.role).toBe("tool");
        expect(rows[0]?.content).toBe("archived t1 for u1");
        expect(rows[0]?.toolCallId).toBe("c1");
    });

    it("거절하면 실행자를 부르지 않고 거절 메모를 남기며 대기 행을 rejected로 전이한다", async () => {
        let called = false;
        const { useCase, messages, pendingTools } = build({
            [CHAT_TOOL.archiveTask]: () => {
                called = true;
                return Promise.resolve("should not run");
            },
        });

        const result = await useCase.execute({ userId: "u1", threadId: "th1", confirmationId: "c1", decision: CHAT_CONFIRM_DECISION.reject });

        expect(called).toBe(false);
        expect(result.status).toBe("rejected");
        expect((await pendingTools.findById("c1"))?.status).toBe("rejected");
        expect((await messages.listByThread("th1"))[0]?.content).toContain("rejected");
    });

    it("남의 스레드로는 확인을 해소하지 못한다", async () => {
        const { useCase } = build(okExecutors);
        await expect(
            useCase.execute({ userId: "intruder", threadId: "th1", confirmationId: "c1", decision: CHAT_CONFIRM_DECISION.approve }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("스레드에 매이지 않은 확인은 존재를 알리지 않는다", async () => {
        const { useCase } = build(okExecutors);
        await expect(
            useCase.execute({ userId: "u1", threadId: "th1", confirmationId: "does-not-exist", decision: CHAT_CONFIRM_DECISION.approve }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("이미 해소된 확인은 다시 처리하지 않는다", async () => {
        const { useCase } = build(okExecutors);
        await useCase.execute({ userId: "u1", threadId: "th1", confirmationId: "c1", decision: CHAT_CONFIRM_DECISION.approve });
        await expect(
            useCase.execute({ userId: "u1", threadId: "th1", confirmationId: "c1", decision: CHAT_CONFIRM_DECISION.reject }),
        ).rejects.toBeInstanceOf(ConflictException);
    });
});
