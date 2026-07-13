import { KIND } from "@monitor/kernel";
import { describe, expect, test } from "vitest";
import type { EventId } from "~web/shared/identity.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { buildFeedEdges } from "~web/widgets/feed/graph/model/edges.js";

function makeEvent(overrides: {
  readonly id: string;
  readonly createdAt: string;
  readonly metadata?: Record<string, unknown>;
}): TimelineEventRecord {
  return {
    id: overrides.id as EventId,
    taskId: "task-1" as TimelineEventRecord["taskId"],
    kind: KIND.actionLogged,
    lane: "implementation",
    title: `event ${overrides.id}`,
    metadata: overrides.metadata ?? {},
    classification: { lane: "implementation", tags: [] },
    createdAt: overrides.createdAt,
  };
}

describe("buildFeedEdges", () => {
  test("빈 입력은 엣지를 만들지 않는다", () => {
    expect(buildFeedEdges([], [])).toEqual([]);
  });

  test("이벤트가 하나면 엣지를 만들지 않는다", () => {
    const events = [makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" })];
    expect(buildFeedEdges(events, [])).toEqual([]);
  });

  test("입력 순서와 무관하게 연속된 이벤트를 시간순으로 연결한다", () => {
    const events = [
      makeEvent({ id: "c", createdAt: "2026-01-01T00:00:02.000Z" }),
      makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeEvent({ id: "b", createdAt: "2026-01-01T00:00:01.000Z" }),
    ];
    const out = buildFeedEdges(events, []);
    const causal = out.filter((e) => e.kind === "causal");
    expect(causal).toEqual([
      { kind: "causal", fromEventId: "a", toEventId: "b" },
      { kind: "causal", fromEventId: "b", toEventId: "c" },
    ]);
  });

  test("명시적 parentEventId 메타데이터는 인과 체인에 더해 explicit 엣지도 만든다", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeEvent({ id: "b", createdAt: "2026-01-01T00:00:01.000Z" }),
      makeEvent({
        id: "c",
        createdAt: "2026-01-01T00:00:02.000Z",
        metadata: { parentEventId: "a" },
      }),
    ];
    const out = buildFeedEdges(events, []);
    expect(out).toContainEqual({ kind: "explicit", fromEventId: "a", toEventId: "c" });
    expect(out).toContainEqual({ kind: "causal", fromEventId: "a", toEventId: "b" });
    expect(out).toContainEqual({ kind: "causal", fromEventId: "b", toEventId: "c" });
  });

  test("가시 이벤트 집합 밖을 가리키는 parent 참조는 크래시 없이 버려진다", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z", metadata: { parentEventId: "ghost" } }),
    ];
    expect(() => buildFeedEdges(events, [])).not.toThrow();
    expect(buildFeedEdges(events, [])).toEqual([]);
  });

  test("자기 자신을 가리키는 parentEventId는 버려진다(셀프루프 없음)", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z", metadata: { parentEventId: "a" } }),
    ];
    expect(buildFeedEdges(events, [])).toEqual([]);
  });

  test("explicit·causal 두 패스에서 중복된 from→to 쌍은 explicit이 이기며 중복 제거된다", () => {
    // b는 시간상 a 바로 다음이면서 명시적으로 a를 parent로 지목한다.
    const events = [
      makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeEvent({ id: "b", createdAt: "2026-01-01T00:00:01.000Z", metadata: { parentEventId: "a" } }),
    ];
    const out = buildFeedEdges(events, []);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ kind: "explicit", fromEventId: "a", toEventId: "b" });
  });

  test("snake_case 메타데이터 키 변형도 지원한다", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeEvent({ id: "z", createdAt: "2026-01-01T00:00:05.000Z", metadata: { source_event_id: "a" } }),
    ];
    const out = buildFeedEdges(events, []);
    expect(out).toContainEqual({ kind: "explicit", fromEventId: "a", toEventId: "z" });
  });
});
