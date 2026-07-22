import { describe, expect, it } from "vitest";
import { InvariantViolationError } from "../error/invariant.error.js";
import { CHAT_EXECUTION_STATUS } from "./chat.const.js";
import { ChatExecutionEntity } from "./chat.execution.entity.js";

const CREATED_AT = new Date("2026-07-22T00:00:00.000Z");

function execution() {
  return ChatExecutionEntity.create({
    userId: "u1",
    threadId: "th1",
    userMessageId: "msg1",
    clientRequestId: "req1",
    inputHash: "hash1",
    requestedBackend: "claude-sdk",
    model: "model1",
    language: "ko",
    now: CREATED_AT,
  });
}

describe("ChatExecutionEntity", () => {
  it("연결 밖에서 복구할 수 있는 대기 실행을 만든다", () => {
    const row = execution();

    expect(row.status).toBe(CHAT_EXECUTION_STATUS.queued);
    expect(row.draftText).toBe("");
    expect(row.draftSeq).toBe(0);
    expect(row.assistantMessageId).toBeNull();
    expect(row.startedAt).toBeNull();
    expect(row.completedAt).toBeNull();
  });

  it("실행·부분 응답·완료 상태를 단조롭게 전진시킨다", () => {
    const row = execution();
    const startedAt = new Date("2026-07-22T00:00:01.000Z");
    row.start(startedAt);
    row.checkpoint("Hel", 1, new Date("2026-07-22T00:00:02.000Z"));
    row.checkpoint("stale", 1, new Date("2026-07-22T00:00:03.000Z"));
    row.checkpoint("Hello", 2, new Date("2026-07-22T00:00:04.000Z"));
    row.complete("assistant1", new Date("2026-07-22T00:00:05.000Z"));

    expect(row.status).toBe(CHAT_EXECUTION_STATUS.completed);
    expect(row.draftText).toBe("Hello");
    expect(row.draftSeq).toBe(2);
    expect(row.assistantMessageId).toBe("assistant1");
    expect(row.startedAt).toEqual(startedAt);
    expect(row.completedAt).toEqual(new Date("2026-07-22T00:00:05.000Z"));
  });

  it("종결된 실행의 상태를 다시 바꾸지 않는다", () => {
    const row = execution();
    row.cancel(new Date("2026-07-22T00:00:01.000Z"));

    expect(() => row.start(new Date("2026-07-22T00:00:02.000Z"))).toThrow(
      InvariantViolationError,
    );
    expect(() => row.fail("late", new Date("2026-07-22T00:00:02.000Z"))).toThrow(
      InvariantViolationError,
    );
  });

  it("프로세스 재시작 뒤 실행 중 상태를 대기로 되돌려 복구한다", () => {
    const row = execution();
    row.start(new Date("2026-07-22T00:00:01.000Z"));

    row.recover(new Date("2026-07-22T00:00:02.000Z"));

    expect(row.status).toBe(CHAT_EXECUTION_STATUS.queued);
    expect(row.startedAt).toBeNull();
  });
});
