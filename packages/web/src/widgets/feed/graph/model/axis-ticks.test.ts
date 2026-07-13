import { describe, expect, test } from "vitest";
import type { TimeRange } from "~web/widgets/feed/graph/model/time-range.js";
import { buildAxisTicks } from "~web/widgets/feed/graph/model/axis-ticks.js";

function range(spanMs: number): TimeRange {
  return { minMs: 0, maxMs: spanMs, spanMs };
}

describe("buildAxisTicks", () => {
  test("span < 5분이면 30초마다 눈금을 찍는다", () => {
    const ticks = buildAxisTicks(range(2 * 60_000));
    const deltas = ticks.slice(1).map((t, i) => t.leftPercent - ticks[i]!.leftPercent);
    for (const d of deltas) expect(d).toBeCloseTo((30_000 / (2 * 60_000)) * 100, 5);
  });

  test("span < 1시간이면 5분마다 눈금을 찍는다", () => {
    const ticks = buildAxisTicks(range(30 * 60_000));
    const deltas = ticks.slice(1).map((t, i) => t.leftPercent - ticks[i]!.leftPercent);
    for (const d of deltas) expect(d).toBeCloseTo((5 * 60_000 / (30 * 60_000)) * 100, 5);
  });

  test("span < 24시간이면 30분마다 눈금을 찍는다", () => {
    const ticks = buildAxisTicks(range(6 * 60 * 60_000));
    const deltas = ticks.slice(1).map((t, i) => t.leftPercent - ticks[i]!.leftPercent);
    for (const d of deltas) expect(d).toBeCloseTo((30 * 60_000 / (6 * 60 * 60_000)) * 100, 5);
  });

  test("여러 날에 걸친 큰 span은 균등한 약 8개 눈금으로 대체되고 유한값을 유지한다", () => {
    const threeDay = 3 * 24 * 60 * 60_000;
    const ticks = buildAxisTicks(range(threeDay));
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(10);
    for (const t of ticks) {
      expect(Number.isFinite(t.leftPercent)).toBe(true);
    }
  });

  test("첫·끝·중간 눈금만 major로 표시하고 나머지는 아니다", () => {
    const ticks = buildAxisTicks(range(30 * 60_000));
    expect(ticks[0]!.major).toBe(true);
    expect(ticks[ticks.length - 1]!.major).toBe(true);
    const midIdx = Math.floor(ticks.length / 2);
    expect(ticks[midIdx]!.major).toBe(true);
    const majorCount = ticks.filter((t) => t.major).length;
    expect(majorCount).toBeLessThanOrEqual(3);
  });

  test("모든 눈금은 가시 범위 0..100 안에 위치한다", () => {
    const ticks = buildAxisTicks(range(45 * 60_000));
    for (const t of ticks) {
      expect(t.leftPercent).toBeGreaterThanOrEqual(0);
      expect(t.leftPercent).toBeLessThanOrEqual(100);
    }
  });

  test("5분 미만 span은 HH:MM:SS 레이블(콜론 2개)을 쓴다", () => {
    const ticks = buildAxisTicks(range(90_000));
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t.label.split(":")).toHaveLength(3);
    }
  });
});
