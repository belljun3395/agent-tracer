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

function makeRule(scope: "global" | "task") {
  return {
    reviewState: "active",
    id: `rule-${scope}`,
    userId: "user-1",
    name: `${scope} rule`,
    trigger: { phrases: ["check"], on: "user" },
    expectation: { kind: "action", tool: "file-read" },
    scope,
    taskId: scope === "task" ? "task-1" : null,
    source: "agent",
    severity: "warn",
    rationale: "reason",
    signature: `sig-${scope}`,
    userEdited: false,
    lastEditedBy: "agent",
    rev: 1,
    sourceJobId: "job-1",
    anchorEventId: "event-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    matchCount: 2,
  } as const;
}

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchRules", () => {
  it("서버 규칙 어휘를 화면 규칙 모델로 변환한다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeRule("task")] });

    const response = await fetchRules();

    expect(response.rules[0]).toMatchObject({
      id: "rule-task",
      trigger: { phrases: ["check"] },
      triggerOn: "user",
      expect: { kind: "action", tool: "file-read" },
      taskId: "task-1",
      sourceJobId: "job-1",
      anchorEventId: "event-1",
      matchCount: 2,
    });
  });
});

describe("fetchTaskRules", () => {
  it("태스크와 전역 규칙을 scope별로 나눈다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeRule("task"), makeRule("global")] });

    const response = await fetchTaskRules(TaskId("task-1"));

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/rules?taskId=task-1");
    expect(response.task.map((rule) => rule.id)).toEqual(["rule-task"]);
    expect(response.global.map((rule) => rule.id)).toEqual(["rule-global"]);
  });
});
