import { NotFoundException } from "@nestjs/common";
import { ChatExecutionEntity, ChatPendingToolEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { describe, expect, it, vi } from "vitest";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { WatchChatExecutionUseCase } from "./watch.chat.execution.usecase.js";

function build() {
    const threads = new InMemoryChatThreadRepository();
    const executions = new InMemoryChatExecutionRepository();
    const pendingTools = new InMemoryChatPendingToolRepository();
    const subscribe = vi.fn(() => () => undefined);
    return {
        threads,
        executions,
        pendingTools,
        subscribe,
        useCase: new WatchChatExecutionUseCase(threads, executions, pendingTools, {
            publish: () => undefined,
            subscribe,
        }),
    };
}

describe("WatchChatExecutionUseCase", () => {
    it("소유한 실행의 DB snapshot과 미결 승인을 제공한다", async () => {
        const { threads, executions, pendingTools, useCase } = build();
        const now = new Date("2026-07-22T00:00:00.000Z");
        threads.seed(ChatThreadEntity.create({ id: "thread-1", userId: "user-1", title: "t", now }));
        const execution = ChatExecutionEntity.create({
            userId: "user-1",
            threadId: "thread-1",
            userMessageId: "message-1",
            clientRequestId: "request-1",
            inputHash: "hash",
            requestedBackend: null,
            model: null,
            language: null,
            now,
        });
        executions.seed(execution);
        pendingTools.seed(ChatPendingToolEntity.create({
            id: "confirm-1",
            threadId: "thread-1",
            messageId: null,
            toolName: "archive_task",
            args: { taskId: "task-1" },
            now,
        }));

        const snapshot = await useCase.snapshot("user-1", "thread-1", execution.id);

        expect(snapshot.execution.id).toBe(execution.id);
        expect(snapshot.confirmations).toEqual([
            { id: "confirm-1", toolName: "archive_task", args: { taskId: "task-1" } },
        ]);
    });

    it("남의 실행은 존재를 숨긴다", async () => {
        const { threads, useCase } = build();
        threads.seed(ChatThreadEntity.create({ id: "thread-1", userId: "user-1", title: "t", now: new Date() }));

        await expect(useCase.snapshot("user-2", "thread-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
});
