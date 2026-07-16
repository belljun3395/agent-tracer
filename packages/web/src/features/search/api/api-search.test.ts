import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchSearch } from "~web/features/search/api/api-search.js";
import { TaskId } from "~web/shared/identity.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  getJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchSearch", () => {
  it("searchType이 tasks면 태스크 엔드포인트만 부른다", async () => {
    mockGetJson.mockResolvedValue({ items: [] });

    await fetchSearch("tasks", "버그");

    expect(mockGetJson).toHaveBeenCalledTimes(1);
    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/tasks/search?q=%EB%B2%84%EA%B7%B8");
  });

  it("searchType이 events면 이벤트 엔드포인트만 부른다", async () => {
    mockGetJson.mockResolvedValue({ items: [] });

    await fetchSearch("events", "버그");

    expect(mockGetJson).toHaveBeenCalledTimes(1);
    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/events/search?q=%EB%B2%84%EA%B7%B8");
  });

  it("태스크 검색 결과를 tasks에 담고 events는 비운다", async () => {
    mockGetJson.mockResolvedValue({
      items: [{ id: "t1", taskId: "t1", title: "T", status: "running", updatedAt: "2026-01-01T00:00:00.000Z" }],
    });

    const response = await fetchSearch("tasks", "버그");

    expect(response.tasks).toHaveLength(1);
    expect(response.events).toEqual([]);
  });

  it("이벤트 검색 결과를 events에 담고 tasks는 비운다", async () => {
    mockGetJson.mockResolvedValue({
      items: [{
        id: "e1",
        eventId: "e1",
        taskId: "t1",
        taskTitle: "T",
        title: "E",
        lane: "implementation",
        kind: "action.logged",
        createdAt: "2026-01-01T00:00:00.000Z",
      }],
    });

    const response = await fetchSearch("events", "버그");

    expect(response.events).toHaveLength(1);
    expect(response.tasks).toEqual([]);
  });

  it("taskId와 limit을 질의 문자열에 싣는다", async () => {
    mockGetJson.mockResolvedValue({ items: [] });

    await fetchSearch("tasks", "버그", { taskId: TaskId("task-1"), limit: 5 });

    expect(mockGetJson).toHaveBeenCalledWith(
      expect.stringContaining("taskId=task-1"),
    );
    expect(mockGetJson).toHaveBeenCalledWith(
      expect.stringContaining("limit=5"),
    );
  });
});
