import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskId } from "~web/shared/identity.js";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchRules, fetchTaskRules } from "~web/entities/rule/api/api-rules.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  deleteRequest: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);

function makeRule(id: string, anchorEventId = "event-1") {
  return {
    reviewState: "active",
    id,
    userId: "user-1",
    name: `${id} rule`,
    expectation: { kind: "action", tool: "file-read" },
    taskId: "task-1",
    anchorEventId,
    source: "agent",
    severity: "warn",
    rationale: "reason",
    signature: `sig-${id}`,
    userEdited: false,
    lastEditedBy: "agent",
    rev: 1,
    sourceJobId: "job-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    matchCount: 2,
  } as const;
}

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchRules", () => {
  it("서버 규칙 어휘를 화면 규칙 모델로 변환한다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeRule("rule-1")] });

    const response = await fetchRules();

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/rules?all=true");
    expect(response.rules[0]).toMatchObject({
      id: "rule-1",
      expect: { kind: "action", tool: "file-read" },
      taskId: "task-1",
      anchorEventId: "event-1",
      sourceJobId: "job-1",
      matchCount: 2,
    });
  });
});

describe("fetchTaskRules", () => {
  it("한 발화에서 나온 규칙 여럿을 그대로 낸다", async () => {
    mockGetJson.mockResolvedValue({
      items: [makeRule("rule-1"), makeRule("rule-2")],
    });

    const response = await fetchTaskRules(TaskId("task-1"));

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/rules?taskId=task-1");
    expect(response.rules.map((rule) => rule.id)).toEqual(["rule-1", "rule-2"]);
    expect(response.rules.map((rule) => rule.anchorEventId)).toEqual(["event-1", "event-1"]);
  });
});
