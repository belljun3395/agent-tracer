import { expect, it } from "vitest";
import { ChatExecutionEntity } from "@monitor/tracer-domain";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { GetNextChatExecutionUseCase } from "./get.next.chat.execution.usecase.js";

it("스레드에서 가장 먼저 접수된 대기 실행을 고른다", async () => {
    const executions = new InMemoryChatExecutionRepository();
    const later = makeExecution("later", new Date("2026-07-22T00:00:02.000Z"));
    const earlier = makeExecution("earlier", new Date("2026-07-22T00:00:01.000Z"));
    executions.seed(later, earlier);

    expect(await new GetNextChatExecutionUseCase(executions).execute("thread-1")).toBe("earlier");
});

function makeExecution(id: string, now: Date): ChatExecutionEntity {
    const execution = ChatExecutionEntity.create({
        userId: "user-1",
        threadId: "thread-1",
        userMessageId: `message-${id}`,
        clientRequestId: `request-${id}`,
        inputHash: `hash-${id}`,
        requestedBackend: null,
        model: null,
        language: null,
        now,
    });
    execution.id = id;
    return execution;
}
