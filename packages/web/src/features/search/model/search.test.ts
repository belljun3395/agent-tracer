import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { EventSearchHit, TaskSearchHit } from "~web/features/search/model/search.js";
import { mergeSearchResults } from "~web/features/search/model/search.js";

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

    expect(response.events[0]?.taskTitle).toBe("Task one");
  });

  it("이벤트에 포함된 태스크 제목은 덮어쓰지 않는다", () => {
    const response = mergeSearchResults([TASK], [event("Indexed title")]);

    expect(response.events[0]?.taskTitle).toBe("Indexed title");
  });
});
