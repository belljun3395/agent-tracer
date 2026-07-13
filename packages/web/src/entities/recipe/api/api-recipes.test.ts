import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchRecipes } from "~web/entities/recipe/api/api-recipes.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  deleteRequest: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchRecipes", () => {
  it("서버 레시피와 통계를 화면 모델로 변환한다", async () => {
    mockGetJson.mockResolvedValue({
      items: [{
        id: "recipe-1",
        userId: "user-1",
        status: "active",
        title: "Inspect failures",
        intent: "Find failure causes",
        description: "Inspect failed tasks",
        summaryMd: "summary",
        request: "request",
        corrections: [],
        pitfalls: [],
        governingRules: [],
        steps: [{ order: 1, action: "inspect" }],
        touchedFiles: ["src/index.ts"],
        contributingSlices: [{ taskId: "task-1", eventIds: ["event-1"] }],
        rationale: "evidence",
        language: "en",
        rev: 2,
        parentRecipeId: null,
        sourceJobId: "job-1",
        userEdited: false,
        lastEditedBy: "agent",
        error: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        resolvedAt: null,
        stats: { applied: 3, success: 2, successRate: 2 / 3 },
      }],
      taskTitles: { "task-1": "Task one" },
    });

    const response = await fetchRecipes("active");

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/recipes?status=active");
    expect(response.recipes[0]).toMatchObject({
      id: "recipe-1",
      sourceCandidateId: null,
      sourceJobId: "job-1",
      appliedCount: 3,
      successCount: 2,
      touchedFiles: [{ path: "src/index.ts", role: "both" }],
    });
    expect(response.taskTitleById.get("task-1")).toBe("Task one");
  });

  it("전체 상태 조회는 status 쿼리를 생략한다", async () => {
    mockGetJson.mockResolvedValue({ items: [], taskTitles: {} });

    await fetchRecipes("all");

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/recipes");
  });
});
