import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskId } from "~web/shared/identity.js";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchTaskTurns } from "~web/entities/task/api/detail.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({ getJson: vi.fn() }));

const mockGetJson = vi.mocked(getJson);

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchTaskTurns", () => {
  it("turn DTO에서 화면 요약에 필요한 필드만 고른다", async () => {
    mockGetJson.mockResolvedValue({
      items: [{
        id: "turn-1",
        taskId: "task-1",
        sessionId: "session-1",
        turnIndex: 3,
        status: "closed",
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:01:00.000Z",
        askedText: "question",
        assistantText: "answer",
        aggregateVerdict: "verified",
        rulesEvaluatedCount: 2,
        verdicts: [],
      }],
    });

    const response = await fetchTaskTurns(TaskId("task-1"));

    expect(response.turns).toEqual([{
      id: "turn-1",
      sessionId: "session-1",
      taskId: "task-1",
      turnIndex: 3,
      status: "closed",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:01:00.000Z",
      aggregateVerdict: "verified",
      rulesEvaluatedCount: 2,
    }]);
  });
});
