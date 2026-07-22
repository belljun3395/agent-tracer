import { EventEmitter } from "node:events";
import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CHAT_TOOL } from "@monitor/kernel";
import { ChatExecutionEntity, ChatPendingToolEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { CreateThreadUseCase } from "~tracer-api/domain/chat/application/command/create.thread.usecase.js";
import { EnqueueChatTurnUseCase } from "~tracer-api/domain/chat/application/command/enqueue.chat.turn.usecase.js";
import { CancelChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/cancel.chat.execution.usecase.js";
import { ConfirmToolUseCase } from "~tracer-api/domain/chat/application/command/confirm.tool.usecase.js";
import { DeleteThreadUseCase } from "~tracer-api/domain/chat/application/command/delete.thread.usecase.js";
import { RenameThreadUseCase } from "~tracer-api/domain/chat/application/command/rename.thread.usecase.js";
import { ListThreadsUseCase } from "~tracer-api/domain/chat/application/query/list.threads.usecase.js";
import { GetThreadUseCase } from "~tracer-api/domain/chat/application/query/get.thread.usecase.js";
import { GetMessagesUseCase } from "~tracer-api/domain/chat/application/query/get.messages.usecase.js";
import { ListChatExecutionsUseCase } from "~tracer-api/domain/chat/application/query/list.chat.executions.usecase.js";
import { WatchChatExecutionUseCase } from "~tracer-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { inMemoryChatTransaction } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.transaction.js";
import { ChatController } from "./chat.controller.js";

class FakeSseResponse extends EventEmitter {
  readonly frames: string[] = [];
  readonly headers = new Map<string, string>();
  statusCode = 0;

  asResponse(): Response {
    return this as unknown as Response;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  flushHeaders(): void {}

  write(chunk: string): boolean {
    this.frames.push(chunk);
    return true;
  }

  end(): this {
    this.emit("close");
    return this;
  }
}

function build() {
  const threads = new InMemoryChatThreadRepository();
  const messages = new InMemoryChatMessageRepository();
  const pendingTools = new InMemoryChatPendingToolRepository();
  const executions = new InMemoryChatExecutionRepository();
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const executors = {
    [CHAT_TOOL.archiveTask]: () => Promise.resolve("archived t1"),
  };
  const executionEvents = new ChatExecutionEvents();
  const dispatcher = { start: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) };
  const transaction = inMemoryChatTransaction({ executions, messages, pendingTools, threads });
  const controller = new ChatController(
    new ListThreadsUseCase(threads),
    new GetThreadUseCase(threads),
    new GetMessagesUseCase(threads, messages),
    new CreateThreadUseCase(threads, clock),
    new EnqueueChatTurnUseCase(
      transaction,
      executions,
      messages,
      dispatcher,
      clock,
    ),
    new ListChatExecutionsUseCase(threads, executions, pendingTools),
    new WatchChatExecutionUseCase(threads, executions, pendingTools, executionEvents),
    new CancelChatExecutionUseCase(threads, executions, dispatcher, clock, executionEvents),
    new ConfirmToolUseCase(threads, messages, pendingTools, executors, clock),
    new DeleteThreadUseCase(threads, executions, dispatcher, transaction),
    new RenameThreadUseCase(threads, clock),
  );
  return { controller, messages, pendingTools, executions, executionEvents, dispatcher };
}

describe("ChatController", () => {
  it("스레드를 만들고 목록에 올린다", async () => {
    const { controller } = build();
    const { thread } = await controller.create("u1", { title: "대화" });
    const listed = await controller.list("u1");
    expect(listed.items.map((row) => row.id)).toContain(thread.id);
  });

  it("메시지와 실행을 즉시 접수하고 Temporal 실행을 시작한다", async () => {
    const { controller, messages, dispatcher } = build();
    const { thread } = await controller.create("u1", { title: "대화" });

    const accepted = await controller.send("u1", thread.id, {
      clientRequestId: "request-1",
      content: "질문",
    });

    expect(accepted.execution.status).toBe("queued");
    expect(dispatcher.start).toHaveBeenCalledWith(accepted.execution.id, thread.id);
    expect(await messages.listByThread(thread.id)).toHaveLength(1);
  });

  it("SSE 연결 종료와 실행 취소를 분리한다", async () => {
    const { controller, executions } = build();
    const { thread } = await controller.create("u1", { title: "대화" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const execution = ChatExecutionEntity.create({
      userId: "u1",
      threadId: thread.id,
      userMessageId: "message-sse",
      clientRequestId: "request-sse",
      inputHash: "hash",
      requestedBackend: null,
      model: null,
      language: null,
      now,
    });
    executions.seed(execution);
    const response = new FakeSseResponse();

    await controller.executionEventStream("u1", thread.id, execution.id, response.asResponse());
    response.emit("close");

    expect(response.statusCode).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.frames.join("")).toContain("event: snapshot");
    expect((await executions.findById(execution.id))?.status).toBe("queued");
  });

  it("대기 중인 쓰기 도구를 승인하면 실행 결과를 tool 메시지로 남긴다", async () => {
    const { controller, messages, pendingTools } = build();
    const { thread } = await controller.create("u1", { title: "대화" });
    pendingTools.seed(
      ChatPendingToolEntity.create({
        id: "pc1",
        threadId: thread.id,
        messageId: null,
        toolName: CHAT_TOOL.archiveTask,
        args: { taskId: "t1" },
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );

    expect(
      (await controller.executions("u1", thread.id)).confirmations,
    ).toEqual([
      { id: "pc1", toolName: "archive_task", args: { taskId: "t1" } },
    ]);

    const result = await controller.confirm("u1", thread.id, "pc1", {
      decision: "approve",
    });

    expect(result.status).toBe("approved");
    expect(
      (await controller.executions("u1", thread.id)).confirmations,
    ).toEqual([]);
    expect(
      (await messages.listByThread(thread.id)).some((m) => m.role === "tool"),
    ).toBe(true);
  });

  it("스레드 제목을 바꾼다", async () => {
    const { controller } = build();
    const { thread } = await controller.create("u1", { title: "대화" });

    const result = await controller.rename("u1", thread.id, {
      title: "바뀐 제목",
    });

    expect(result.thread.title).toBe("바뀐 제목");
  });

  it("스레드를 지우면 메시지도 함께 지워진다", async () => {
    const { controller, messages } = build();
    const { thread } = await controller.create("u1", { title: "대화" });
    const accepted = await controller.send("u1", thread.id, {
      clientRequestId: "request-delete",
      content: "질문",
    });
    await vi.waitFor(async () => {
      expect((await controller.executions("u1", thread.id)).items[0]?.id).toBe(
        accepted.execution.id,
      );
      expect((await messages.listByThread(thread.id)).length).toBe(1);
    });

    const result = await controller.remove("u1", thread.id);

    expect(result.deleted).toBe(true);
    await expect(controller.detail("u1", thread.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await messages.listByThread(thread.id)).toHaveLength(0);
  });
});
