import { KIND } from "@monitor/kernel";
import { describe, expect, test } from "vitest";
import type { EventId } from "~web/shared/identity.js";
import type { TimelineEventRecord, TimelineLane } from "~web/entities/task/model/timeline/event.js";
import { axisEventsOf, buildTimeRange, msToLeftPercent } from "~web/widgets/feed/graph/model/time-range.js";

function makeEvent(
  id: string,
  createdAt: string,
  lane: TimelineLane = "implementation",
): TimelineEventRecord {
  return {
    id: id as EventId,
    taskId: "task-1" as TimelineEventRecord["taskId"],
    kind: KIND.actionLogged,
    lane,
    title: `event ${id}`,
    metadata: {},
    classification: { lane, tags: [] },
    createdAt,
  };
}

describe("buildTimeRange", () => {
  test("이벤트가 없으면 nowMs에서 끝나는 1분짜리 창을 합성한다", () => {
    const nowMs = Date.parse("2026-01-01T00:10:00.000Z");
    expect(buildTimeRange([], nowMs)).toEqual({
      minMs: nowMs - 60_000,
      maxMs: nowMs,
      spanMs: 60_000,
    });
  });

  test("진행 중 태스크는 현재 시각까지 최대 경계를 늘린다", () => {
    const events = [makeEvent("a", "2026-01-01T00:00:00.000Z")];
    const nowMs = Date.parse("2026-01-01T00:05:00.000Z");
    const range = buildTimeRange(events, nowMs);
    expect(range.maxMs).toBe(nowMs);
    expect(range.minMs).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
  });

  test("멈춘 태스크는 마지막 이벤트에서 시간 창을 고정한다", () => {
    const events = [
      makeEvent("a", "2026-01-01T00:00:00.000Z"),
      makeEvent("b", "2026-01-01T00:10:00.000Z"),
    ];
    const range = buildTimeRange(events, Date.parse("2026-01-01T01:00:00.000Z"), {
      freezeAtLastEvent: true,
    });
    expect(range.maxMs).toBe(Date.parse("2026-01-01T00:10:00.000Z"));
  });

  test("1분 하한보다 짧은 시간 창을 1분까지 늘린다", () => {
    const events = [
      makeEvent("a", "2026-01-01T00:00:00.000Z"),
      makeEvent("b", "2026-01-01T00:00:05.000Z"),
    ];
    const range = buildTimeRange(events, Date.parse("2026-01-01T00:00:05.000Z"), {
      freezeAtLastEvent: true,
    });
    expect(range.spanMs).toBe(60_000);
    expect(range.maxMs - range.minMs).toBe(60_000);
  });

  test("입력 순서와 무관하게 이벤트 경계를 고른다", () => {
    const events = [
      makeEvent("late", "2026-01-01T02:00:00.000Z"),
      makeEvent("early", "2026-01-01T00:00:00.000Z"),
    ];
    const range = buildTimeRange(events, Date.parse("2026-01-01T02:00:00.000Z"), {
      freezeAtLastEvent: true,
    });
    expect(range.minMs).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(range.maxMs).toBe(Date.parse("2026-01-01T02:00:00.000Z"));
  });
});

describe("axisEventsOf", () => {
  test("텔레메트리 꼬리 이벤트는 동결된 시간축을 연장하지 않는다", () => {
    const events = [
      makeEvent("a", "2026-01-01T00:00:00.000Z"),
      makeEvent("b", "2026-01-01T00:05:00.000Z"),
      makeEvent("snapshot", "2026-01-01T00:20:00.000Z", "telemetry"),
    ];
    const range = buildTimeRange(
      axisEventsOf(events),
      Date.parse("2026-01-01T01:00:00.000Z"),
      { freezeAtLastEvent: true },
    );
    expect(range.maxMs).toBe(Date.parse("2026-01-01T00:05:00.000Z"));
  });

  test("모든 이벤트가 telemetry면 원본 목록을 유지한다", () => {
    const events = [makeEvent("a", "2026-01-01T00:00:00.000Z", "telemetry")];
    expect(axisEventsOf(events)).toEqual(events);
  });

  test("telemetry가 섞여 있으면 나머지만 남긴다", () => {
    const events = [
      makeEvent("a", "2026-01-01T00:00:00.000Z", "implementation"),
      makeEvent("b", "2026-01-01T00:05:00.000Z", "telemetry"),
    ];
    expect(axisEventsOf(events)).toEqual([events[0]]);
  });
});

describe("msToLeftPercent", () => {
  const range = { minMs: 0, maxMs: 1000, spanMs: 1000 };

  test("범위 시작을 0%로 매핑한다", () => {
    expect(msToLeftPercent(0, range)).toBe(0);
  });

  test("범위 끝을 100%로 매핑한다", () => {
    expect(msToLeftPercent(1000, range)).toBe(100);
  });

  test("중간점을 50%로 매핑한다", () => {
    expect(msToLeftPercent(500, range)).toBe(50);
  });

  test("범위 시작 이전 값을 0%로 제한한다", () => {
    expect(msToLeftPercent(-500, range)).toBe(0);
  });

  test("범위 끝 이후 값을 100%로 제한한다", () => {
    expect(msToLeftPercent(1500, range)).toBe(100);
  });
});
