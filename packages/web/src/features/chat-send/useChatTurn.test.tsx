import { StrictMode, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatThreadId } from "~web/shared/identity.js";
import type { ChatStreamHandlers } from "~web/entities/chat/api/stream-chat-message.js";
import { useChatTurn } from "~web/features/chat-send/useChatTurn.js";

const { streamChatMessageMock } = vi.hoisted(() => ({
  streamChatMessageMock: vi.fn(),
}));

vi.mock("~web/entities/chat/api/stream-chat-message.js", () => ({
  streamChatMessage: streamChatMessageMock,
}));

// 마운트 이펙트가 두 번 도는 dev 조건에서 진행 중인 턴이 부수적으로 끊기지 않는지 보려고 StrictMode로 감싼다.
function wrapper({ children }: { readonly children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <StrictMode>{children}</StrictMode>
    </QueryClientProvider>
  );
}

const DONE_SUMMARY = {
  text: "",
  backend: "claude-sdk" as const,
  toolCalls: [],
  modelUsed: "m",
  costUsd: null,
  numTurns: 1,
  errorSummary: null,
};

beforeEach(() => {
  streamChatMessageMock.mockReset();
});

describe("useChatTurn", () => {
  it("델타·도구 호출·확인 요청·기억 갱신을 누적하다가 done에서 스트리밍 상태를 비운다", async () => {
    let capturedHandlers: ChatStreamHandlers | undefined;
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, handlers: ChatStreamHandlers) => {
        capturedHandlers = handlers;
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });

    act(() => result.current.sendMessage("hello"));
    expect(result.current.isStreaming).toBe(true);

    act(() => capturedHandlers?.onAssistantDelta?.("Hel"));
    act(() => capturedHandlers?.onAssistantDelta?.("lo"));
    expect(result.current.assistantDraft).toBe("Hello");

    act(() =>
      capturedHandlers?.onToolCall?.({ id: "call-1", name: "get_task", args: {} }),
    );
    expect(result.current.toolActivity).toHaveLength(1);
    expect(result.current.toolActivity[0]?.result).toBeNull();

    act(() =>
      capturedHandlers?.onToolResult?.({ toolCallId: "call-1", toolName: "get_task", content: "ok" }),
    );
    expect(result.current.toolActivity[0]?.result?.content).toBe("ok");

    act(() =>
      capturedHandlers?.onConfirmRequest?.({
        id: "confirm-1",
        toolName: "update_task",
        summary: "rename",
        args: {},
      }),
    );
    expect(result.current.pendingConfirms).toHaveLength(1);

    act(() => capturedHandlers?.onMemoryUpdated?.({ key: "tz", content: "KST" }));
    expect(result.current.memoryUpdates).toHaveLength(1);

    act(() =>
      capturedHandlers?.onDone?.({
        text: "Hello",
        backend: "claude-sdk",
        toolCalls: [],
        modelUsed: "m",
        costUsd: null,
        numTurns: 1,
        errorSummary: null,
      }),
    );

    // done 직후에는 스트리밍만 끝나고, 방금 흘린 텍스트는 그대로 남아 빈 말풍선이
    // 번쩍이지 않는다.
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.assistantDraft).toBe("Hello");
    expect(result.current.toolActivity).toHaveLength(1);

    // 히스토리 재조회가 끝나야 드래프트를 지우고 저장된 메시지에 자리를 넘긴다.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.assistantDraft).toBe("");
    expect(result.current.toolActivity).toHaveLength(0);
    // 확인 요청은 별도 승인/거절 엔드포인트로 해소될 때까지 남는다.
    expect(result.current.pendingConfirms).toHaveLength(1);
  });

  it("재렌더나 StrictMode 이펙트 재실행이 진행 중인 턴을 끊지 않는다", () => {
    let capturedSignal: AbortSignal | undefined;
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, _handlers: ChatStreamHandlers, signal?: AbortSignal) => {
        capturedSignal = signal;
        return Promise.resolve();
      },
    );

    const { result, rerender } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), {
      wrapper,
    });

    act(() => result.current.sendMessage("hello"));
    expect(streamChatMessageMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);

    // 같은 스레드로 여러 번 재렌더해도 새 스트림을 열지도, 진행 중인 것을 끊지도 않는다.
    rerender();
    rerender();
    expect(streamChatMessageMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);
    expect(result.current.isStreaming).toBe(true);
  });

  it("진짜 스레드 전환은 진행 중인 턴을 끊고 상태를 비운다", () => {
    let capturedSignal: AbortSignal | undefined;
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, _handlers: ChatStreamHandlers, signal?: AbortSignal) => {
        capturedSignal = signal;
        return Promise.resolve();
      },
    );

    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string }) => useChatTurn(ChatThreadId(threadId)),
      { wrapper, initialProps: { threadId: "thread-1" } },
    );

    act(() => result.current.sendMessage("hello"));
    expect(capturedSignal?.aborted).toBe(false);

    rerender({ threadId: "thread-2" });
    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.assistantDraft).toBe("");
  });

  it("stop은 진행 중인 턴을 끊고 스트리밍 상태를 비운다", () => {
    let capturedSignal: AbortSignal | undefined;
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, _handlers: ChatStreamHandlers, signal?: AbortSignal) => {
        capturedSignal = signal;
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });
    act(() => result.current.sendMessage("hello"));
    expect(result.current.isStreaming).toBe(true);

    act(() => result.current.stop());
    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.assistantDraft).toBe("");
  });

  it("dismissConfirm은 해소된 확인 요청만 화면에서 지운다", async () => {
    let capturedHandlers: ChatStreamHandlers | undefined;
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, handlers: ChatStreamHandlers) => {
        capturedHandlers = handlers;
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });
    act(() => result.current.sendMessage("hello"));
    act(() =>
      capturedHandlers?.onConfirmRequest?.({
        id: "confirm-1",
        toolName: "update_task",
        summary: "rename",
        args: {},
      }),
    );
    expect(result.current.pendingConfirms).toHaveLength(1);

    act(() => result.current.dismissConfirm("confirm-1"));

    expect(result.current.pendingConfirms).toHaveLength(0);
  });

  it("응답 중 전송은 현재 턴을 취소하지 않고 순서대로 대기열에 쌓는다", () => {
    const signals: (AbortSignal | undefined)[] = [];
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, _handlers: ChatStreamHandlers, signal?: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });

    act(() => result.current.sendMessage("first"));
    act(() => result.current.sendMessage("second"));
    act(() => result.current.sendMessage("third"));

    // 첫 메시지만 POST(=스트림 시작)되고, 진행 중인 턴은 끊기지 않는다.
    expect(streamChatMessageMock).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.queuedCount).toBe(2);
  });

  it("현재 턴이 끝나면 대기 메시지를 순서대로 새 턴으로 자동 처리한다", async () => {
    const contents: string[] = [];
    const handlersByCall: ChatStreamHandlers[] = [];
    streamChatMessageMock.mockImplementation(
      (_threadId: string, body: { content: string }, handlers: ChatStreamHandlers) => {
        contents.push(body.content);
        handlersByCall.push(handlers);
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });

    act(() => result.current.sendMessage("first"));
    act(() => result.current.sendMessage("second"));
    act(() => result.current.sendMessage("third"));
    expect(contents).toEqual(["first"]);
    expect(result.current.queuedCount).toBe(2);

    // 첫 턴 종료 → 히스토리 재조회 뒤 second가 자동 시작한다.
    await act(async () => {
      handlersByCall[0]?.onDone?.(DONE_SUMMARY);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(contents).toEqual(["first", "second"]);
    expect(result.current.queuedCount).toBe(1);

    // 둘째 턴 종료 → third가 자동 시작한다.
    await act(async () => {
      handlersByCall[1]?.onDone?.(DONE_SUMMARY);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(contents).toEqual(["first", "second", "third"]);
    expect(result.current.queuedCount).toBe(0);

    // 셋째 턴 종료 → 대기열이 비었으니 새 턴을 시작하지 않는다.
    await act(async () => {
      handlersByCall[2]?.onDone?.(DONE_SUMMARY);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(contents).toHaveLength(3);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.queuedCount).toBe(0);
  });

  it("대기 메시지가 자동 시작되어도 밀려난 이전 턴의 늦은 델타가 새 드래프트에 섞이지 않는다", async () => {
    const handlersByCall: ChatStreamHandlers[] = [];
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, handlers: ChatStreamHandlers) => {
        handlersByCall.push(handlers);
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });

    act(() => result.current.sendMessage("first"));
    act(() => handlersByCall[0]?.onAssistantDelta?.("A"));
    expect(result.current.assistantDraft).toBe("A");

    // 응답 중 둘째 전송은 대기열로 가고 첫 턴 드래프트는 그대로다.
    act(() => result.current.sendMessage("second"));
    expect(result.current.assistantDraft).toBe("A");
    expect(result.current.queuedCount).toBe(1);

    // 첫 턴이 끝나면 둘째 메시지가 턴 B로 자동 시작한다.
    await act(async () => {
      handlersByCall[0]?.onDone?.(DONE_SUMMARY);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(handlersByCall).toHaveLength(2);
    expect(result.current.assistantDraft).toBe("");

    // 턴 A의 늦은 델타·도구 이벤트가 도착해도 턴 B의 상태를 오염시키지 않는다.
    act(() => handlersByCall[0]?.onAssistantDelta?.("stale"));
    act(() => handlersByCall[0]?.onToolCall?.({ id: "call-a", name: "get_task", args: {} }));
    expect(result.current.assistantDraft).toBe("");
    expect(result.current.toolActivity).toHaveLength(0);

    // 턴 B의 델타는 정상 반영된다.
    act(() => handlersByCall[1]?.onAssistantDelta?.("B"));
    expect(result.current.assistantDraft).toBe("B");
  });

  it("stop은 진행 중인 턴을 끊고 대기열도 비운다", () => {
    const signals: (AbortSignal | undefined)[] = [];
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, _handlers: ChatStreamHandlers, signal?: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useChatTurn(ChatThreadId("thread-1")), { wrapper });
    act(() => result.current.sendMessage("first"));
    act(() => result.current.sendMessage("second"));
    expect(result.current.queuedCount).toBe(1);

    act(() => result.current.stop());
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.queuedCount).toBe(0);
  });

  it("스레드 전환은 대기열을 비우고 이전 스레드의 대기 메시지를 시작하지 않는다", () => {
    streamChatMessageMock.mockImplementation(() => Promise.resolve());

    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string }) => useChatTurn(ChatThreadId(threadId)),
      { wrapper, initialProps: { threadId: "thread-1" } },
    );

    act(() => result.current.sendMessage("first"));
    act(() => result.current.sendMessage("second"));
    expect(result.current.queuedCount).toBe(1);

    rerender({ threadId: "thread-2" });
    expect(result.current.queuedCount).toBe(0);
    expect(result.current.isStreaming).toBe(false);
    // thread-1의 대기 메시지가 thread-2에서 새 턴으로 살아나지 않는다.
    expect(streamChatMessageMock).toHaveBeenCalledTimes(1);
  });

  it("스레드를 전환하면 이전 스레드 턴의 늦은 이벤트가 무시된다", () => {
    const handlersByCall: ChatStreamHandlers[] = [];
    streamChatMessageMock.mockImplementation(
      (_threadId: string, _body: unknown, handlers: ChatStreamHandlers) => {
        handlersByCall.push(handlers);
        return Promise.resolve();
      },
    );

    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string }) => useChatTurn(ChatThreadId(threadId)),
      { wrapper, initialProps: { threadId: "thread-1" } },
    );

    act(() => result.current.sendMessage("hello"));
    rerender({ threadId: "thread-2" });
    expect(result.current.assistantDraft).toBe("");

    // thread-1 턴의 늦은 델타·도구 이벤트가 thread-2 화면에 새지 않는다.
    act(() => handlersByCall[0]?.onAssistantDelta?.("leak"));
    act(() => handlersByCall[0]?.onToolCall?.({ id: "call-1", name: "get_task", args: {} }));
    act(() =>
      handlersByCall[0]?.onMemoryUpdated?.({ key: "tz", content: "KST" }),
    );
    expect(result.current.assistantDraft).toBe("");
    expect(result.current.toolActivity).toHaveLength(0);
    expect(result.current.memoryUpdates).toHaveLength(0);
  });

  it("빈 내용이나 스레드가 없으면 스트림을 시작하지 않는다", () => {
    const { result } = renderHook(() => useChatTurn(null), { wrapper });
    act(() => result.current.sendMessage("hello"));
    expect(streamChatMessageMock).not.toHaveBeenCalled();
  });
});
