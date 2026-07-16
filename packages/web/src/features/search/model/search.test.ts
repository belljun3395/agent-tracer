import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type {
  EventSearchHit,
  MemoSearchHit,
  TaskSearchHit,
} from "~web/features/search/model/search.js";
import { isMemoHit, mergeSearchResults } from "~web/features/search/model/search.js";

const TASK: TaskSearchHit = {
  id: "task-hit-1",
  taskId: "task-1",
  title: "Task one",
  status: "completed",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function event(taskTitle: string): EventSearchHit {
  return {
    id: "event-hit-1",
    eventId: "event-1",
    taskId: "task-1",
    taskTitle,
    title: "Event one",
    lane: "implementation",
    kind: KIND.actionLogged,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("mergeSearchResults", () => {
  it("이벤트에 태스크 제목이 없으면 태스크 검색 결과에서 채운다", () => {
    const response = mergeSearchResults([TASK], [event("")]);
    const hit = response.events[0];

    expect(hit && !isMemoHit(hit) ? hit.taskTitle : undefined).toBe("Task one");
  });

  it("이벤트에 포함된 태스크 제목은 덮어쓰지 않는다", () => {
    const response = mergeSearchResults([TASK], [event("Indexed title")]);
    const hit = response.events[0];

    expect(hit && !isMemoHit(hit) ? hit.taskTitle : undefined).toBe("Indexed title");
  });

  it("메모 히트는 태스크 제목 보정을 건너뛴다", () => {
    const memoHit: MemoSearchHit = {
      hitType: "memo",
      id: "memo-1",
      taskId: "task-1",
      eventId: "event-1",
      author: "human",
      body: "메모 본문",
    };

    const response = mergeSearchResults([TASK], [memoHit]);

    expect(response.events[0]).toEqual(memoHit);
  });
});

describe("isMemoHit", () => {
  it("hitType이 있는 히트만 메모로 판별한다", () => {
    const memoHit: MemoSearchHit = {
      hitType: "memo",
      id: "memo-1",
      taskId: "task-1",
      eventId: null,
      author: "agent",
      body: "메모",
    };

    expect(isMemoHit(memoHit)).toBe(true);
    expect(isMemoHit(TASK)).toBe(false);
    expect(isMemoHit(event(""))).toBe(false);
  });
});
