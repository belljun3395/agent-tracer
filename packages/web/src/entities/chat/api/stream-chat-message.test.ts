import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearUserIdentity } from "~web/shared/api/user-identity.js";
import { ChatThreadId } from "~web/shared/identity.js";
import { streamChatMessage, type ChatStreamHandlers } from "~web/entities/chat/api/stream-chat-message.js";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearUserIdentity();
});

function sseStream(frames: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
}

function collectHandlers(): { readonly calls: string[]; readonly handlers: ChatStreamHandlers } {
  const calls: string[] = [];
  return {
    calls,
    handlers: {
      onAssistantDelta: (text) => calls.push(`delta:${text}`),
      onToolCall: (call) => calls.push(`tool_call:${call.name}`),
      onToolResult: (result) => calls.push(`tool_result:${result.toolName}`),
      onConfirmRequest: (request) => calls.push(`confirm:${request.toolName}`),
      onMemoryUpdated: (update) => calls.push(`memory:${update.key}`),
      onDone: (summary) => calls.push(`done:${summary.text}`),
      onError: (message) => calls.push(`error:${message}`),
    },
  };
}

describe("streamChatMessage", () => {
  it("SSE 프레임을 이벤트 이름 순서대로 파싱해 핸들러로 흘려보낸다", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        sseStream([
          'event: assistant_delta\ndata: {"text":"Hel"}\n\n',
          'event: assistant_delta\ndata: {"text":"lo"}\n\n',
          'event: tool_call\ndata: {"id":"call-1","name":"get_task","args":{}}\n\n',
          'event: tool_result\ndata: {"toolCallId":"call-1","toolName":"get_task","content":"ok"}\n\n',
          'event: tool_confirm_request\ndata: {"id":"confirm-1","toolName":"update_task","summary":"rename","args":{}}\n\n',
          'event: memory_updated\ndata: {"key":"tz","content":"KST"}\n\n',
          'event: done\ndata: {"message":{"text":"Hello","backend":"claude-sdk","toolCalls":[],"modelUsed":"m","costUsd":null,"numTurns":1,"errorSummary":null}}\n\n',
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    );

    const { calls, handlers } = collectHandlers();
    await streamChatMessage(ChatThreadId("thread-1"), { content: "hi" }, handlers);

    expect(calls).toEqual([
      "delta:Hel",
      "delta:lo",
      "tool_call:get_task",
      "tool_result:get_task",
      "confirm:update_task",
      "memory:tz",
      "done:Hello",
    ]);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url as string).toMatch(/\/api\/v1\/chat\/threads\/thread-1\/messages$/);
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
  });

  it("빈 줄로 아직 끊기지 않은 프레임은 다음 청크를 기다린다", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        sseStream(['event: assistant_delta\ndata: {"tex', 't":"ok"}\n\n']),
        { status: 200 },
      ),
    );

    const { calls, handlers } = collectHandlers();
    await streamChatMessage(ChatThreadId("thread-1"), { content: "hi" }, handlers);

    expect(calls).toEqual(["delta:ok"]);
  });

  it("응답이 실패면 서버 오류 메시지를 onError로 낸다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: "not_found", message: "Thread not found" } }), {
        status: 404,
      }),
    );

    const { calls, handlers } = collectHandlers();
    await streamChatMessage(ChatThreadId("missing"), { content: "hi" }, handlers);

    expect(calls).toEqual(["error:Thread not found"]);
  });

  it("중단 신호가 이미 꺼졌으면 오류를 내지 않는다", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

    const { calls, handlers } = collectHandlers();
    await streamChatMessage(
      ChatThreadId("thread-1"),
      { content: "hi" },
      handlers,
      controller.signal,
    );

    expect(calls).toEqual([]);
  });
});
