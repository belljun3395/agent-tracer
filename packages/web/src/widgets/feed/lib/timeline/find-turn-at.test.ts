import { describe, expect, it } from "vitest";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";
import { findTurnAtMs } from "~web/widgets/feed/lib/timeline/find-turn-at.js";

describe("findTurnAtMs", () => {
  it("턴이 없으면 찾지 못한다", () => {
    expect(findTurnAtMs(Date.parse("2026-07-13T00:00:00.000Z"), [])).toBeUndefined();
  });

  it("열린 턴은 시작 이후의 시각을 포함한다", () => {
    const open = turn({
      id: "open",
      startedAt: "2026-07-13T00:00:00.000Z",
      endedAt: null,
    });

    expect(findTurnAtMs(Date.parse("2026-07-14T00:00:00.000Z"), [open])).toBe(open);
  });

  it("시작 경계는 포함하고 종료 경계는 제외한다", () => {
    const closed = turn({
      id: "closed",
      startedAt: "2026-07-13T00:00:00.000Z",
      endedAt: "2026-07-13T00:01:00.000Z",
    });

    expect(findTurnAtMs(Date.parse(closed.startedAt), [closed])).toBe(closed);
    expect(findTurnAtMs(Date.parse(closed.endedAt!), [closed])).toBeUndefined();
  });

  it("입력 순서와 무관하게 시각을 포함하는 턴을 찾는다", () => {
    const later = turn({
      id: "later",
      startedAt: "2026-07-13T00:02:00.000Z",
      endedAt: "2026-07-13T00:03:00.000Z",
    });
    const earlier = turn({
      id: "earlier",
      startedAt: "2026-07-13T00:00:00.000Z",
      endedAt: "2026-07-13T00:01:00.000Z",
    });

    expect(
      findTurnAtMs(Date.parse("2026-07-13T00:00:30.000Z"), [later, earlier]),
    ).toBe(earlier);
  });
});

function turn(
  overrides: Pick<TaskTurnSummary, "id" | "startedAt" | "endedAt">,
): TaskTurnSummary {
  return {
    sessionId: "session-1",
    taskId: "task-1",
    turnIndex: 1,
    status: overrides.endedAt === null ? "open" : "closed",
    aggregateVerdict: null,
    rulesEvaluatedCount: 0,
    ...overrides,
  };
}
