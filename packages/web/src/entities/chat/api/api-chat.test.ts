import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatThreadId } from "~web/shared/identity.js";
import { getJson, patchJson, postJson } from "~web/shared/api/client/json-methods.js";
import {
  confirmChatTool,
  createChatThread,
  fetchChatMessages,
  fetchChatThreads,
  fetchChatExecutions,
  startChatTurn,
  cancelChatExecution,
  renameChatThread,
} from "~web/entities/chat/api/api-chat.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  deleteRequest: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);
const mockPostJson = vi.mocked(postJson);
const mockPatchJson = vi.mocked(patchJson);

beforeEach(() => {
  mockGetJson.mockReset();
  mockPostJson.mockReset();
  mockPatchJson.mockReset();
});

describe("renameChatThread", () => {
  it("제목을 PATCH하고 화면 모델로 변환한다", async () => {
    mockPatchJson.mockResolvedValue({
      thread: {
        id: "thread-1",
        userId: "user-1",
        title: "새 제목",
        summary: null,
        backend: null,
        createdAt: "2026-07-22T00:00:00.000Z",
        updatedAt: "2026-07-22T00:01:00.000Z",
      },
    });

    const response = await renameChatThread(ChatThreadId("thread-1"), "새 제목");

    expect(mockPatchJson).toHaveBeenCalledWith("/api/v1/chat/threads/thread-1", {
      title: "새 제목",
    });
    expect(response.thread.title).toBe("새 제목");
  });
});

describe("fetchChatThreads", () => {
  it("서버 스레드 어휘를 화면 스레드 모델로 변환한다", async () => {
    mockGetJson.mockResolvedValue({
      items: [
        {
          id: "thread-1",
          userId: "user-1",
          title: "First thread",
          summary: null,
          backend: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const response = await fetchChatThreads();

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/chat/threads");
    expect(response.threads[0]).toMatchObject({
      id: "thread-1",
      title: "First thread",
    });
  });
});

describe("fetchChatMessages", () => {
  it("스레드의 메시지를 쌓인 순서대로 변환한다", async () => {
    mockGetJson.mockResolvedValue({
      items: [
        {
          id: "msg-1",
          threadId: "thread-1",
          role: "user",
          content: "hi",
          toolCalls: null,
          toolCallId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const response = await fetchChatMessages(ChatThreadId("thread-1"));

    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/v1/chat/threads/thread-1/messages",
    );
    expect(response.messages.map((m) => m.content)).toEqual(["hi"]);
  });
});

describe("createChatThread", () => {
  it("제목을 실어 새 스레드를 만든다", async () => {
    mockPostJson.mockResolvedValue({
      thread: {
        id: "thread-2",
        userId: "user-1",
        title: "New thread",
        summary: null,
        backend: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const response = await createChatThread({ title: "New thread" });

    expect(mockPostJson).toHaveBeenCalledWith("/api/v1/chat/threads", {
      title: "New thread",
    });
    expect(response.thread.id).toBe("thread-2");
  });
});

describe("confirmChatTool", () => {
  it("승인 결정을 확인 엔드포인트로 보낸다", async () => {
    mockPostJson.mockResolvedValue({
      confirmationId: "confirm-1",
      toolName: "update_task",
      status: "approved",
      result: "done",
    });

    const response = await confirmChatTool({
      threadId: ChatThreadId("thread-1"),
      confirmationId: "confirm-1",
      decision: "approve",
    });

    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/v1/chat/threads/thread-1/confirmations/confirm-1",
      { decision: "approve" },
    );
    expect(response.status).toBe("approved");
  });
});

describe("durable chat execution API", () => {
  const execution = {
    id: "execution-1",
    threadId: "thread-1",
    userMessageId: "message-1",
    status: "queued" as const,
    requestedBackend: null,
    draftText: "",
    draftSeq: 0,
    assistantMessageId: null,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
  };

  it("클라이언트 요청 식별자와 함께 턴을 접수한다", async () => {
    mockPostJson.mockResolvedValue({
      message: {
        id: "message-1",
        threadId: "thread-1",
        role: "user",
        content: "hello",
        toolCalls: null,
        toolCallId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      execution,
    });

    const response = await startChatTurn(ChatThreadId("thread-1"), {
      clientRequestId: "request-1",
      content: "hello",
    });

    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/v1/chat/threads/thread-1/messages",
      {
        clientRequestId: "request-1",
        content: "hello",
      },
    );
    expect(response.execution.id).toBe("execution-1");
  });

  it("재진입할 때 실행 목록을 다시 읽고 명시적 취소를 보낸다", async () => {
    mockGetJson.mockResolvedValue({
      items: [execution],
      confirmations: [
        {
          id: "confirm-1",
          toolName: "archive_task",
          args: { taskId: "task-1" },
        },
      ],
    });
    mockPostJson.mockResolvedValue({
      execution: { ...execution, status: "canceled" },
    });

    const listed = await fetchChatExecutions(ChatThreadId("thread-1"));
    await cancelChatExecution(ChatThreadId("thread-1"), "execution-1");

    expect(listed.executions).toEqual([execution]);
    expect(listed.confirmations).toEqual([
      {
        id: "confirm-1",
        toolName: "archive_task",
        args: { taskId: "task-1" },
        summary: "archive_task(taskId=task-1)",
      },
    ]);
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/v1/chat/threads/thread-1/executions/execution-1/cancel",
    );
  });
});
