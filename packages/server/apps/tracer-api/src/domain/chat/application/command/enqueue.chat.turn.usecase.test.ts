import { describe, expect, it } from "vitest";
import { ChatThreadEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import type { ChatExecutionDispatcherPort } from "~tracer-api/domain/chat/port/chat.execution.dispatcher.port.js";
import type { ChatTransactionPort } from "~tracer-api/domain/chat/port/chat.transaction.port.js";
import { ChatExecutionIdempotencyConflictError } from "~tracer-api/domain/chat/model/chat.execution.errors.js";
import { EnqueueChatTurnUseCase } from "./enqueue.chat.turn.usecase.js";

function build() {
    const executions = new InMemoryChatExecutionRepository();
    const messages = new InMemoryChatMessageRepository();
    const threads = new InMemoryChatThreadRepository();
    const pendingTools = new InMemoryChatPendingToolRepository();
    threads.seed(
        ChatThreadEntity.create({
            id: "th1",
            userId: "u1",
            title: "chat",
            now: new Date("2026-07-22T00:00:00.000Z"),
        }),
    );
    const transaction: ChatTransactionPort = {
        run: (work) => work({
            chatExecutions: executions,
            chatMessages: messages,
            chatPendingTools: pendingTools,
            chatThreads: threads,
        }),
    };
    const started: string[] = [];
    const dispatcher: ChatExecutionDispatcherPort = {
        start: (executionId) => {
            started.push(executionId);
            return Promise.resolve();
        },
        cancel: () => Promise.resolve(),
    };
    const useCase = new EnqueueChatTurnUseCase(
        transaction,
        executions,
        messages,
        dispatcher,
        new FixedClock(new Date("2026-07-22T00:00:01.000Z")),
    );
    return { useCase, messages, started };
}

describe("EnqueueChatTurnUseCase", () => {
    it("사용자 메시지와 대기 실행을 함께 접수하고 연결 밖 실행을 시작한다", async () => {
        const { useCase, messages, started } = build();

        const accepted = await useCase.execute({
            userId: "u1",
            threadId: "th1",
            clientRequestId: "request-1",
            content: "hello",
        });

        expect(accepted.message.content).toBe("hello");
        expect(accepted.execution.userMessageId).toBe(accepted.message.id);
        expect(accepted.execution.status).toBe("queued");
        expect(await messages.listByThread("th1")).toHaveLength(1);
        expect(started).toEqual([accepted.execution.id]);
    });

    it("같은 요청 식별자의 재전송은 메시지와 유료 실행을 중복 생성하지 않는다", async () => {
        const { useCase, messages, started } = build();
        const input = {
            userId: "u1",
            threadId: "th1",
            clientRequestId: "request-1",
            content: "hello",
        } as const;

        const first = await useCase.execute(input);
        const retried = await useCase.execute(input);

        expect(retried.execution.id).toBe(first.execution.id);
        expect(await messages.listByThread("th1")).toHaveLength(1);
        expect(started).toEqual([first.execution.id, first.execution.id]);
    });

    it("같은 요청 식별자를 다른 입력에 재사용하면 거부한다", async () => {
        const { useCase } = build();
        await useCase.execute({
            userId: "u1",
            threadId: "th1",
            clientRequestId: "request-1",
            content: "hello",
        });

        await expect(
            useCase.execute({
                userId: "u1",
                threadId: "th1",
                clientRequestId: "request-1",
                content: "different",
            }),
        ).rejects.toBeInstanceOf(ChatExecutionIdempotencyConflictError);
    });
});
