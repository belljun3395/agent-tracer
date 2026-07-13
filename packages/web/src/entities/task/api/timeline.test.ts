import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskId } from "~web/shared/identity.js";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { fetchTaskTimeline } from "~web/entities/task/api/timeline.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({ getJson: vi.fn() }));

const mockGetJson = vi.mocked(getJson);

beforeEach(() => {
  mockGetJson.mockReset();
});

describe("fetchTaskTimeline", () => {
  it("타임라인 DTO를 화면 이벤트 레코드로 변환한다", async () => {
    mockGetJson.mockResolvedValue({
      items: [{
        id: "event-1",
        seq: "1",
        taskId: "task-1",
        sessionId: "session-1",
        turnId: "turn-1",
        kind: "gen_ai.user.message",
        lane: "user",
        title: "raw title",
        displayTitle: "display title",
        body: "body",
        filePaths: ["src/index.ts"],
        metadata: { source: "test" },
        occurredAt: "2026-01-01T00:00:00.000Z",
      }],
      nextCursor: "older-1",
    });

    const response = await fetchTaskTimeline(TaskId("task-1"));

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/tasks/task-1/timeline?limit=200");
    expect(response).toMatchObject({
      olderCursor: "older-1",
      timeline: [{
        id: "event-1",
        title: "display title",
        paths: { filePaths: ["src/index.ts"], mentionedPaths: [] },
        classification: { lane: "user", tags: [] },
      }],
    });
  });
});
