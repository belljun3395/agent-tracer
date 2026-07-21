import { describe, expect, it } from "vitest";
import type { Response } from "express";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { FakeChatAgent, fakeChatRegistry } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.agent.js";
import { CreateThreadUseCase } from "~tracer-api/domain/chat/application/command/create.thread.usecase.js";
import { AppendUserMessageUseCase } from "~tracer-api/domain/chat/application/command/append.user.message.usecase.js";
import { RunChatTurnUseCase } from "~tracer-api/domain/chat/application/command/run.chat.turn.usecase.js";
import { ListThreadsUseCase } from "~tracer-api/domain/chat/application/query/list.threads.usecase.js";
import { GetThreadUseCase } from "~tracer-api/domain/chat/application/query/get.thread.usecase.js";
import { GetMessagesUseCase } from "~tracer-api/domain/chat/application/query/get.messages.usecase.js";
import { ChatController } from "./chat.controller.js";

function build() {
    const threads = new InMemoryChatThreadRepository();
    const messages = new InMemoryChatMessageRepository();
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const registry = fakeChatRegistry(new FakeChatAgent("답", [{ id: "c1", name: "get_task", args: { taskId: "t1" } }]));
    const controller = new ChatController(
        new ListThreadsUseCase(threads),
        new GetThreadUseCase(threads),
        new GetMessagesUseCase(threads, messages),
        new CreateThreadUseCase(threads, clock),
        new AppendUserMessageUseCase(threads, messages, clock),
        new RunChatTurnUseCase(threads, messages, registry, clock),
    );
    return { controller, messages };
}

function fakeResponse(): { res: Response; frames: () => string } {
    const chunks: string[] = [];
    const res = {
        setHeader: () => res,
        flushHeaders: () => {},
        on: () => res,
        write: (chunk: string) => {
            chunks.push(chunk);
            return true;
        },
        end: () => {},
    } as unknown as Response;
    return { res, frames: () => chunks.join("") };
}

describe("ChatController", () => {
    it("스레드를 만들고 목록에 올린다", async () => {
        const { controller } = build();
        const { thread } = await controller.create("u1", { title: "대화" });
        const listed = await controller.list("u1");
        expect(listed.items.map((row) => row.id)).toContain(thread.id);
    });

    it("메시지를 SSE로 흘리며 델타와 도구 호출과 done 프레임을 낸다", async () => {
        const { controller, messages } = build();
        const { thread } = await controller.create("u1", { title: "대화" });
        const { res, frames } = fakeResponse();

        await controller.send("u1", thread.id, { content: "질문" }, res);

        const text = frames();
        expect(text).toContain("event: assistant_delta");
        expect(text).toContain("event: tool_call");
        expect(text).toContain("event: done");
        // 사용자 메시지와 어시스턴트 메시지가 모두 스레드에 남는다.
        expect(await messages.listByThread(thread.id)).toHaveLength(2);
    });
});
