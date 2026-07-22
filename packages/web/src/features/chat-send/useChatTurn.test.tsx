import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatThreadId } from "~web/shared/identity.js";
import type {
  ChatExecutionRecord,
  ChatMessageRecord,
} from "~web/entities/chat/model/chat.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";
import { useChatTurn } from "~web/features/chat-send/useChatTurn.js";

const { cancelChatExecutionMock, fetchChatExecutionsMock, startChatTurnMock } =
  vi.hoisted(() => ({
    cancelChatExecutionMock: vi.fn(),
    fetchChatExecutionsMock: vi.fn(),
    startChatTurnMock: vi.fn(),
  }));
const { watchChatExecutionMock } = vi.hoisted(() => ({
  watchChatExecutionMock: vi.fn(),
}));

vi.mock("~web/entities/chat/api/api-chat.js", () => ({
  cancelChatExecution: cancelChatExecutionMock,
  fetchChatExecutions: fetchChatExecutionsMock,
  startChatTurn: startChatTurnMock,
}));
vi.mock("~web/entities/chat/api/watch-chat-execution.js", () => ({
  watchChatExecution: watchChatExecutionMock,
}));

let queryClient: QueryClient;

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function execution(
  overrides: Partial<ChatExecutionRecord> = {},
): ChatExecutionRecord {
  return {
    id: "execution-1",
    threadId: ChatThreadId("thread-1"),
    userMessageId: "message-1",
    status: "running",
    requestedBackend: "claude-sdk",
    draftText: "partial answer",
    draftSeq: 1,
    assistantMessageId: null,
    error: null,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:01.000Z",
    startedAt: "2026-07-22T00:00:01.000Z",
    completedAt: null,
    ...overrides,
  };
}

const message: ChatMessageRecord = {
  id: "message-1",
  threadId: ChatThreadId("thread-1"),
  role: "user",
  content: "hello",
  toolCalls: null,
  toolCallId: null,
  createdAt: "2026-07-22T00:00:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cancelChatExecutionMock.mockReset();
  fetchChatExecutionsMock
    .mockReset()
    .mockResolvedValue({ executions: [], confirmations: [] });
  startChatTurnMock.mockReset();
  watchChatExecutionMock.mockReset().mockReturnValue(new Promise(() => {}));
});

describe("useChatTurn", () => {
  it("접수 응답 전에도 보낸 메시지를 즉시 보여 준다", () => {
    startChatTurnMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), {
      wrapper,
    });

    act(() => result.current.sendMessage(" hello "));

    expect(result.current.pendingMessages.map((row) => row.content)).toEqual(["hello"]);
    expect(result.current.isStreaming).toBe(true);
  });

  it("접수된 사용자 메시지와 실행을 캐시에 중복 없이 합친다", async () => {
    startChatTurnMock.mockResolvedValue({
      message,
      execution: execution({ status: "queued" }),
    });
    queryClient.setQueryData(
      monitorQueryKeys.chatMessages(ChatThreadId("thread-1")),
      {
        messages: [],
      },
    );
    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), {
      wrapper,
    });

    act(() => result.current.sendMessage("hello"));

    await waitFor(() => expect(result.current.pendingMessages).toHaveLength(0));
    expect(
      queryClient.getQueryData<{ messages: readonly ChatMessageRecord[] }>(
        monitorQueryKeys.chatMessages(ChatThreadId("thread-1")),
      )?.messages,
    ).toEqual([message]);
  });

  it("새로 마운트해도 서버의 실행 상태와 부분 응답을 복구한다", async () => {
    fetchChatExecutionsMock.mockResolvedValue({
      executions: [execution()],
      confirmations: [
        {
          id: "confirm-1",
          toolName: "archive_task",
          summary: "archive_task(taskId=task-1)",
          args: { taskId: "task-1" },
        },
      ],
    });

    const { result, unmount } = renderHook(
      () => useChatTurn(ChatThreadId("thread-1")),
      {
        wrapper,
      },
    );

    await waitFor(() =>
      expect(result.current.activeProcess).toBe("partial answer"),
    );
    expect(result.current.pendingConfirms).toHaveLength(1);
    expect(result.current.isStreaming).toBe(true);
    unmount();
    expect(cancelChatExecutionMock).not.toHaveBeenCalled();
  });

  it("Stop을 눌렀을 때만 서버 실행 취소를 요청한다", async () => {
    const running = execution();
    fetchChatExecutionsMock.mockResolvedValue({
      executions: [running],
      confirmations: [],
    });
    cancelChatExecutionMock.mockResolvedValue({
      execution: execution({
        status: "canceled",
        completedAt: "2026-07-22T00:00:02.000Z",
      }),
    });
    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => result.current.stop());

    await waitFor(() =>
      expect(cancelChatExecutionMock).toHaveBeenCalledWith(
        ChatThreadId("thread-1"),
        running.id,
      ),
    );
  });

  it("실패한 실행의 오류를 재진입 뒤에도 보여 준다", async () => {
    fetchChatExecutionsMock.mockResolvedValue({
      executions: [
        execution({ status: "failed", error: "provider unavailable" }),
      ],
      confirmations: [],
    });

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.error).toBe("provider unavailable"),
    );
    expect(result.current.isStreaming).toBe(false);
  });

  it("접수 요청이 실패하면 본문을 보존하고 재시도할 수 있다", async () => {
    startChatTurnMock.mockRejectedValue(new Error("network unavailable"));
    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), {
      wrapper,
    });

    act(() => result.current.sendMessage("hello"));

    await waitFor(() =>
      expect(result.current.error).toBe("network unavailable"),
    );
    expect(result.current.pendingMessages).toEqual([
      expect.objectContaining({ content: "hello", status: "failed" }),
    ]);
    expect(result.current.isStreaming).toBe(false);

    startChatTurnMock.mockResolvedValue({
      message,
      execution: execution({ status: "queued" }),
    });
    act(() => result.current.retryMessage(result.current.pendingMessages[0]!.clientRequestId));
    await waitFor(() => expect(result.current.pendingMessages).toHaveLength(0));
    expect(startChatTurnMock).toHaveBeenCalledTimes(2);
  });

  it("실패한 접수 메시지를 사용자가 삭제할 수 있다", async () => {
    startChatTurnMock.mockRejectedValue(new Error("network unavailable"));
    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });
    act(() => result.current.sendMessage("hello"));
    await waitFor(() => expect(result.current.pendingMessages[0]?.status).toBe("failed"));
    act(() => result.current.dismissMessage(result.current.pendingMessages[0]!.clientRequestId));
    expect(result.current.pendingMessages).toHaveLength(0);
  });

  it("동시 접수 응답이 역순이어도 메시지 캐시는 전송 순서를 지킨다", async () => {
    const first = deferred<{ message: ChatMessageRecord; execution: ChatExecutionRecord }>();
    const second = deferred<{ message: ChatMessageRecord; execution: ChatExecutionRecord }>();
    startChatTurnMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    queryClient.setQueryData(monitorQueryKeys.chatMessages(ChatThreadId("thread-1")), { messages: [] });
    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });
    act(() => {
      result.current.sendMessage("first");
      result.current.sendMessage("second");
    });
    const secondMessage = { ...message, id: "message-2", content: "second" };
    await act(async () => second.resolve({ message: secondMessage, execution: execution({ id: "execution-2", userMessageId: "message-2", status: "queued" }) }));
    expect(result.current.pendingMessages.map((row) => row.content)).toEqual(["first", "second"]);
    await act(async () => first.resolve({ message: { ...message, content: "first" }, execution: execution({ status: "queued" }) }));
    await waitFor(() => expect(result.current.pendingMessages).toHaveLength(0));
    expect(queryClient.getQueryData<{ messages: readonly ChatMessageRecord[] }>(monitorQueryKeys.chatMessages(ChatThreadId("thread-1")))?.messages.map((row) => row.content)).toEqual(["first", "second"]);
  });

  it("스레드를 바꾼 뒤 끝난 이전 접수는 현재 스레드 상태를 오염시키지 않는다", async () => {
    const request = deferred<{ message: ChatMessageRecord; execution: ChatExecutionRecord }>();
    startChatTurnMock.mockReturnValueOnce(request.promise);
    const { result, rerender } = renderHook(
      ({ threadId }) => useChatTurn(threadId),
      { initialProps: { threadId: ChatThreadId("thread-1") }, wrapper },
    );
    act(() => result.current.sendMessage("old thread"));

    rerender({ threadId: ChatThreadId("thread-2") });
    await act(async () => request.reject(new Error("late failure")));

    expect(result.current.pendingMessages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
