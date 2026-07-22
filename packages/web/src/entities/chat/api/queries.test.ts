import { describe, expect, it } from "vitest";
import { ChatThreadId } from "~web/shared/identity.js";
import type { ChatExecutionRecord } from "~web/entities/chat/model/chat.js";
import { chatExecutionPollInterval, mergeExecutionResponses } from "./queries.js";

const NOW = Date.parse("2026-07-22T00:01:00.000Z");

function execution(
  status: ChatExecutionRecord["status"],
  activeSince: string,
): ChatExecutionRecord {
  return {
    id: "execution-1",
    threadId: ChatThreadId("thread-1"),
    userMessageId: "message-1",
    status,
    requestedBackend: null,
    draftText: "",
    draftSeq: 0,
    assistantMessageId: null,
    error: null,
    createdAt: activeSince,
    updatedAt: activeSince,
    startedAt: status === "running" ? activeSince : null,
    completedAt: null,
  };
}

describe("chatExecutionPollInterval", () => {
  it("활성 실행이 없으면 polling을 멈춘다", () => {
    expect(
      chatExecutionPollInterval(
        [execution("completed", "2026-07-22T00:00:59.000Z")],
        NOW,
      ),
    ).toBe(false);
  });

  it.each([
    ["2026-07-22T00:00:55.000Z", 1_000],
    ["2026-07-22T00:00:45.000Z", 2_000],
    ["2026-07-22T00:00:20.000Z", 5_000],
  ])("실행 경과 시간 %s에 맞춰 %i ms로 늦춘다", (activeSince, expected) => {
    expect(chatExecutionPollInterval([execution("running", activeSince)], NOW)).toBe(expected);
  });

  it("SSE 장애 fallback에서는 활성 실행을 5초마다 확인한다", () => {
    expect(
      chatExecutionPollInterval(
        [execution("running", "2026-07-22T00:00:59.000Z")],
        NOW,
        true,
      ),
    ).toBe(5_000);
  });

  it("SSE 연결 중에도 저빈도 안전 polling을 유지한다", () => {
    expect(chatExecutionPollInterval([execution("running", "2026-07-22T00:00:59.000Z")], NOW, false, true)).toBe(10_000);
  });
});

describe("mergeExecutionResponses", () => {
  it("늦게 도착한 polling 결과가 최신 SSE 상태를 되돌리지 않는다", () => {
    const running = execution("running", "2026-07-22T00:00:01.000Z");
    const completed = {
      ...execution("completed", "2026-07-22T00:00:01.000Z"),
      updatedAt: "2026-07-22T00:00:03.000Z",
    };
    const previous = { executions: [completed], confirmations: [] };
    const incoming = { executions: [running], confirmations: [] };

    expect(mergeExecutionResponses(previous, incoming)).toBe(previous);
  });
});
