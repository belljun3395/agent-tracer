import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatThreadId } from "~web/shared/identity.js";
import type { UseChatTurnResult } from "~web/features/chat-send/useChatTurn.js";
import type { ChatMessageRecord } from "~web/entities/chat/model/chat.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { ChatMessageStream } from "~web/widgets/chat/ChatMessageStream.js";

afterEach(cleanup);
const scrollIntoViewMock = vi.fn();
beforeEach(() => {
  scrollIntoViewMock.mockReset();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
});

function turn(overrides: Partial<UseChatTurnResult>): UseChatTurnResult {
  return {
    isStreaming: false,
    pendingMessages: [],
    activeProcess: "",
    completedProcesses: [],
    pendingConfirms: [],
    error: null,
    queuedCount: 0,
    sendMessage: vi.fn(),
    stop: vi.fn(),
    retryMessage: vi.fn(),
    dismissMessage: vi.fn(),
    dismissConfirm: vi.fn(),
    ...overrides,
  };
}

function renderStream(value: UseChatTurnResult, messages: readonly ChatMessageRecord[] = []) {
  return render(
    <UiStoreProvider store={createUiStore({ persisted: false })}>
      <ChatMessageStream
        threadId={ChatThreadId("thread-1")}
        messages={messages}
        turn={value}
      />
    </UiStoreProvider>,
  );
}

describe("ChatMessageStream", () => {
  it("완료 뒤에도 탐색 과정과 최종 답변을 분리해 보존한다", () => {
    const assistant: ChatMessageRecord = {
      id: "message-2",
      threadId: ChatThreadId("thread-1"),
      role: "assistant",
      content: "최종 답변입니다.",
      toolCalls: null,
      toolCallId: null,
      createdAt: "2026-07-22T00:00:02.000Z",
    };

    renderStream(
      turn({
        completedProcesses: [
          {
            assistantMessageId: assistant.id,
            transcript: "태스크를 검색해볼게요.최종 답변입니다.",
          },
        ],
      }),
      [assistant],
    );

    expect(screen.getByText("Process")).not.toBeNull();
    expect(screen.getByText("태스크를 검색해볼게요.")).not.toBeNull();
    expect(screen.getByText("최종 답변입니다.")).not.toBeNull();
  });

  it("서버 응답을 기다리는 사용자 메시지와 대기 메시지 본문을 즉시 보여 준다", () => {
    renderStream(
      turn({
        isStreaming: true,
        pendingMessages: [
          { clientRequestId: "1", content: "first question", status: "sending", error: null },
          { clientRequestId: "2", content: "second question", status: "sending", error: null },
          { clientRequestId: "3", content: "third question", status: "sending", error: null },
        ],
        queuedCount: 2,
      }),
    );

    expect(screen.getByText("first question")).not.toBeNull();
    expect(screen.getByText("second question")).not.toBeNull();
    expect(screen.getByText("third question")).not.toBeNull();
  });

  it("과거 메시지를 읽는 중에는 위치를 보존하고 새 응답 이동 버튼을 보인다", () => {
    const initial = turn({ isStreaming: true, activeProcess: "first" });
    const rendered = renderStream(initial);
    const viewport = rendered.container.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    expect(viewport).not.toBeNull();
    Object.defineProperties(viewport!, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    fireEvent.scroll(viewport!);
    scrollIntoViewMock.mockClear();

    rendered.rerender(
      <UiStoreProvider store={createUiStore({ persisted: false })}>
        <ChatMessageStream
          threadId={ChatThreadId("thread-1")}
          messages={[]}
          turn={turn({ isStreaming: true, activeProcess: "first second" })}
        />
      </UiStoreProvider>,
    );

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Jump to latest" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
    });
  });

  it("작업 내용이 보이면 별도 Thinking 표시를 중복하지 않는다", () => {
    renderStream(turn({ isStreaming: true, activeProcess: "working detail" }));
    expect(screen.getByText("Working…")).not.toBeNull();
    expect(screen.queryByText("Thinking…")).toBeNull();
  });

  it("실패한 메시지에서 재시도와 삭제를 제공한다", () => {
    const value = turn({ pendingMessages: [{ clientRequestId: "request-1", content: "keep me", status: "failed", error: "offline" }] });
    renderStream(value);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(value.retryMessage).toHaveBeenCalledWith("request-1");
    expect(value.dismissMessage).toHaveBeenCalledWith("request-1");
  });
});
