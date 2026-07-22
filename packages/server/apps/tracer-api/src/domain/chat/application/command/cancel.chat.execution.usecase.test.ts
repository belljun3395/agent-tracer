import { NotFoundException } from "@nestjs/common";
import { ChatExecutionEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { describe, expect, it, vi } from "vitest";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { CancelChatExecutionUseCase } from "./cancel.chat.execution.usecase.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";

describe("CancelChatExecutionUseCase", () => {
  it("소유한 실행만 디스패처에 취소한다", async () => {
    const threads = new InMemoryChatThreadRepository();
    const executions = new InMemoryChatExecutionRepository();
    const now = new Date("2026-01-01T00:00:00.000Z");
    threads.seed(
      ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now }),
    );
    const execution = ChatExecutionEntity.create({
      userId: "u1",
      threadId: "th1",
      userMessageId: "m1",
            clientRequestId: "r1",
            inputHash: "h1",
            requestedBackend: null,
            model: null,
            language: null,
            now,
    });
    executions.seed(execution);
    const cancel = vi.fn(async () => undefined);
    const useCase = new CancelChatExecutionUseCase(threads, executions, {
      start: vi.fn(),
      cancel,
    }, new FixedClock(now), new ChatExecutionEvents());

    const result = await useCase.execute("u1", "th1", execution.id);

    expect(cancel).toHaveBeenCalledWith(execution.id);
    expect(result.execution.status).toBe("canceled");
  });

  it("남의 실행은 존재를 숨긴다", async () => {
    const threads = new InMemoryChatThreadRepository();
    const now = new Date();
    threads.seed(
      ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now }),
    );
    const useCase = new CancelChatExecutionUseCase(
      threads,
      new InMemoryChatExecutionRepository(),
      { start: vi.fn(), cancel: vi.fn() },
      new FixedClock(now),
      new ChatExecutionEvents(),
    );

    await expect(
      useCase.execute("u2", "th1", "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
