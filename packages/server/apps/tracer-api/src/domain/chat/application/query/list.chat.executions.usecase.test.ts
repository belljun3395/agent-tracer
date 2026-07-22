import { NotFoundException } from "@nestjs/common";
import {
  ChatExecutionEntity,
  ChatPendingToolEntity,
  ChatThreadEntity,
} from "@monitor/tracer-domain";
import { describe, expect, it } from "vitest";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { ListChatExecutionsUseCase } from "./list.chat.executions.usecase.js";

describe("ListChatExecutionsUseCase", () => {
  it("소유한 스레드의 실행과 미결 승인만 복원한다", async () => {
    const threads = new InMemoryChatThreadRepository();
    const executions = new InMemoryChatExecutionRepository();
    const pendingTools = new InMemoryChatPendingToolRepository();
    const now = new Date("2026-01-01T00:00:00.000Z");
    threads.seed(
      ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now }),
    );
    executions.seed(
      ChatExecutionEntity.create({
        userId: "u1",
        threadId: "th1",
        userMessageId: "m1",
                clientRequestId: "r1",
                inputHash: "h1",
                requestedBackend: null,
                model: null,
                language: null,
                now,
      }),
    );
    const pending = ChatPendingToolEntity.create({
      id: "p1",
      threadId: "th1",
      messageId: null,
      toolName: "archive_task",
      args: { taskId: "t1" },
      now,
    });
    const resolved = ChatPendingToolEntity.create({
      id: "p2",
      threadId: "th1",
      messageId: null,
      toolName: "archive_task",
      args: { taskId: "t2" },
      now,
    });
    resolved.reject(now);
    pendingTools.seed(pending, resolved);
    const useCase = new ListChatExecutionsUseCase(
      threads,
      executions,
      pendingTools,
    );

    const result = await useCase.execute("u1", "th1");

    expect(result.items).toHaveLength(1);
    expect(result.confirmations).toEqual([
      { id: "p1", toolName: "archive_task", args: { taskId: "t1" } },
    ]);
  });

  it("남의 스레드 실행은 주지 않는다", async () => {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(
      ChatThreadEntity.create({
        id: "th1",
        userId: "u1",
        title: "t",
        now: new Date(),
      }),
    );
    const useCase = new ListChatExecutionsUseCase(
      threads,
      new InMemoryChatExecutionRepository(),
      new InMemoryChatPendingToolRepository(),
    );

    await expect(useCase.execute("u2", "th1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
