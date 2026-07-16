import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventId, TaskId } from "~web/shared/identity.js";
import { getJson } from "~web/shared/api/client/json-methods.js";
import {
  fetchEventMemos,
  fetchMemos,
  fetchTaskMemos,
} from "~web/entities/memo/api/api-memos.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  deleteRequest: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);

function makeMemo(id: string, eventId: string | null = null) {
  return {
    id,
    userId: "user-1",
    taskId: "task-1",
    eventId,
    body: `${id} body`,
    author: "human",
    lastEditedBy: "user-1",
    rev: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as const;
}

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchMemos", () => {
  it("사용자의 메모 전체를 화면 메모 모델로 변환한다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeMemo("memo-1")] });

    const response = await fetchMemos();

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/memos");
    expect(response.memos[0]).toMatchObject({
      id: "memo-1",
      taskId: "task-1",
      eventId: null,
      body: "memo-1 body",
    });
  });
});

describe("fetchTaskMemos", () => {
  it("태스크 수준 메모만 요청한다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeMemo("memo-1")] });

    const response = await fetchTaskMemos(TaskId("task-1"));

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/memos?taskId=task-1");
    expect(response.memos.map((memo) => memo.id)).toEqual(["memo-1"]);
  });
});

describe("fetchEventMemos", () => {
  it("이벤트 하나의 메모 스레드를 요청한다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeMemo("memo-1", "event-1")] });

    const response = await fetchEventMemos(TaskId("task-1"), EventId("event-1"));

    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/v1/memos?taskId=task-1&eventId=event-1",
    );
    expect(response.memos[0]?.eventId).toBe("event-1");
  });
});
