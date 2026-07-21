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

  it("빈 내용이나 스레드가 없으면 스트림을 시작하지 않는다", () => {
    const { result } = renderHook(() => useChatTurn(null), { wrapper });
    act(() => result.current.sendMessage("hello"));
    expect(streamChatMessageMock).not.toHaveBeenCalled();
  });
});
