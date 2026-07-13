import { AGENT_TRACER_ATTR, KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";
import { buildFeed } from "~web/widgets/feed/lib/timeline/group-acts.js";

const BASE = "2026-07-10T00:00:00.000Z";

function event(
  id: string,
  kind: TimelineEventRecord["kind"],
  createdAt: string,
  metadata: Record<string, unknown> = {},
): TimelineEventRecord {
  return {
    id: id as TimelineEventRecord["id"],
    taskId: "task-1" as TimelineEventRecord["taskId"],
    sessionId: "session-1" as NonNullable<TimelineEventRecord["sessionId"]>,
    turnId: "turn-1",
    kind,
    lane: "user",
    title: id,
    body: id,
    metadata,
    classification: { lane: "user", tags: [] },
    createdAt,
  };
}

describe("buildFeed", () => {
  it("늦게 수집한 중간 발화를 참조한 최종 응답 직전에 표시한다", () => {
    const response = event("response", KIND.assistantResponse, "2026-07-10T00:00:02.000Z");
    const commentary = event(
      "commentary",
      KIND.assistantCommentary,
      "2026-07-10T00:00:03.000Z",
      { [AGENT_TRACER_ATTR.turnResponseEventId]: response.id },
    );
    const turn: TaskTurnSummary = {
      id: "turn-1",
      taskId: "task-1",
      sessionId: "session-1",
      turnIndex: 1,
      status: "closed",
      startedAt: BASE,
      endedAt: "2026-07-10T00:00:02.001Z",
      aggregateVerdict: null,
      rulesEvaluatedCount: 0,
    };

    const feed = buildFeed([
      response,
      commentary,
      event("user", KIND.userMessage, BASE),
    ], Date.parse(BASE), [turn]);

    expect(feed.filter((item) => item.kind === "act").map((item) => item.vm.event.id))
      .toEqual(["user", "commentary", "response"]);
    expect(feed.filter((item) => item.kind === "turn-mark")).toHaveLength(1);
  });

  it("제때 수집한 중간 발화의 기존 시간 순서는 유지한다", () => {
    const response = event("response", KIND.assistantResponse, "2026-07-10T00:00:04.000Z");
    const commentary = event(
      "commentary",
      KIND.assistantCommentary,
      "2026-07-10T00:00:01.000Z",
      { [AGENT_TRACER_ATTR.turnResponseEventId]: response.id },
    );

    const feed = buildFeed([
      response,
      event("tool", KIND.executeTool, "2026-07-10T00:00:02.000Z"),
      commentary,
    ], Date.parse(BASE));

    expect(feed.filter((item) => item.kind === "act").map((item) => item.vm.event.id))
      .toEqual(["commentary", "tool", "response"]);
  });
});
