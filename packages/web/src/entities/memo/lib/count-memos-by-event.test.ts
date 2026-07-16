import { describe, expect, it } from "vitest";
import { EventId, MemoId, TaskId } from "~web/shared/identity.js";
import type { MemoRecord } from "~web/entities/memo/model/memo.js";
import { countMemosByEvent } from "~web/entities/memo/lib/count-memos-by-event.js";

function makeMemo(overrides: Partial<MemoRecord>): MemoRecord {
  return {
    id: MemoId("memo-1"),
    taskId: TaskId("task-1"),
    eventId: EventId("event-1"),
    body: "memo body",
    author: "human",
    lastEditedBy: "user-1",
    rev: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("countMemosByEvent", () => {
  it("같은 이벤트에 매달린 메모 수를 이벤트별로 센다", () => {
    const memos = [
      makeMemo({ id: MemoId("memo-1"), eventId: EventId("event-1") }),
      makeMemo({ id: MemoId("memo-2"), eventId: EventId("event-1") }),
      makeMemo({ id: MemoId("memo-3"), eventId: EventId("event-2") }),
    ];

    const counts = countMemosByEvent(memos, TaskId("task-1"));

    expect(counts.get("event-1")).toBe(2);
    expect(counts.get("event-2")).toBe(1);
  });

  it("태스크 수준 메모(eventId가 null)는 세지 않는다", () => {
    const memos = [makeMemo({ eventId: null })];

    const counts = countMemosByEvent(memos, TaskId("task-1"));

    expect(counts.size).toBe(0);
  });

  it("다른 태스크의 메모는 세지 않는다", () => {
    const memos = [makeMemo({ taskId: TaskId("task-2") })];

    const counts = countMemosByEvent(memos, TaskId("task-1"));

    expect(counts.size).toBe(0);
  });
});
