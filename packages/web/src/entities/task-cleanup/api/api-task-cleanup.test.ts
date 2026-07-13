import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchTaskCleanupSuggestions } from "~web/entities/task-cleanup/api/api-task-cleanup.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchTaskCleanupSuggestions", () => {
  it("정리 제안 DTO의 nullable 필드를 화면 모델의 선택 필드로 변환한다", async () => {
    mockGetJson.mockResolvedValue({
      items: [{
        id: "suggestion-1",
        jobId: "job-1",
        taskId: "task-1",
        kind: "archive",
        currentValue: false,
        proposedValue: true,
        rationale: "inactive",
        status: "pending",
        error: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        resolvedAt: null,
      }],
    });

    const response = await fetchTaskCleanupSuggestions();

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/task-cleanup/suggestions?status=pending");
    expect(response.suggestions).toEqual([{
      id: "suggestion-1",
      jobId: "job-1",
      taskId: "task-1",
      kind: "archive",
      currentValue: false,
      proposedValue: true,
      rationale: "inactive",
      status: "pending",
      createdAt: "2026-01-01T00:00:00.000Z",
    }]);
  });
});
