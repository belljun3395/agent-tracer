import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchTasksPage } from "~web/entities/task/api/list.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({ getJson: vi.fn() }));

const mockGetJson = vi.mocked(getJson);

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchTasksPage", () => {
  it("목록 필터와 커서를 쿼리 문자열로 전달한다", async () => {
    mockGetJson.mockResolvedValue({ items: [], nextCursor: "next-1" });

    const response = await fetchTasksPage({
      archived: "archived",
      origin: "server-sdk",
      status: "completed",
      rootOnly: true,
      limit: 25,
      cursor: "cursor-1",
    });

    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/v1/tasks?archived=true&origin=server-sdk&root=true&status=completed&limit=25&cursor=cursor-1",
    );
    expect(response.page).toEqual({ limit: 25, hasMore: true, nextCursor: "next-1" });
  });
});
