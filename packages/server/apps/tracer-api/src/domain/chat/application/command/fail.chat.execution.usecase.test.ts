import { expect, it } from "vitest";
import { ChatExecutionEntity } from "@monitor/tracer-domain";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { FailChatExecutionUseCase } from "./fail.chat.execution.usecase.js";

it("활성 실행만 실패로 끝낸다", async () => {
    const now = new Date("2026-07-22T00:00:00.000Z");
    const executions = new InMemoryChatExecutionRepository();
    const execution = ChatExecutionEntity.create({
        userId: "u1",
        threadId: "t1",
        userMessageId: "m1",
        clientRequestId: "r1",
        inputHash: "h1",
        requestedBackend: null,
        model: null,
        language: null,
        now,
    });
    executions.seed(execution);
    const useCase = new FailChatExecutionUseCase(
        executions,
        new FixedClock(now),
        new ChatExecutionEvents(),
    );

    await useCase.execute(execution.id, "worker failed");

    expect((await executions.findById(execution.id))?.status).toBe("failed");
});
