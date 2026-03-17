import { describe, expect, it } from "vitest";

import {
  LANE_HEIGHT,
  LEFT_GUTTER,
  NODE_WIDTH,
  RULER_HEIGHT,
  TIMELINE_LANES,
  buildTimelineConnectors,
  buildTimelineLayout,
  buildTimestampTicks,
  formatRelativeTime
} from "./timeline.js";

describe("buildTimelineLayout", () => {
  const BASE_EVENTS = [
    {
      id: "1",
      taskId: "task-1",
      kind: "tool.used",
      lane: "implementation" as const,
      title: "Edit server",
      metadata: {},
      classification: { lane: "implementation" as const, tags: [], matches: [] },
      createdAt: "2026-03-16T09:00:00.000Z"
    },
    {
      id: "2",
      taskId: "task-1",
      kind: "terminal.command",
      lane: "rules" as const,
      title: "npm test",
      metadata: {},
      classification: { lane: "rules" as const, tags: [], matches: [] },
      createdAt: "2026-03-16T09:01:00.000Z"
    }
  ];

  it("creates layout positions across five lanes", () => {
    const nowMs = Date.parse("2026-03-16T09:02:00.000Z");
    const layout = buildTimelineLayout(BASE_EVENTS, 1, nowMs);

    expect(layout.width).toBeGreaterThan(500);
    expect(layout.items[0]?.left).toBeLessThan(layout.items[1]?.left ?? 0);
    expect(layout.items[0]?.top).not.toBe(layout.items[1]?.top);
    // tops should be offset by RULER_HEIGHT
    expect(layout.items[0]?.top).toBeGreaterThanOrEqual(RULER_HEIGHT);
  });

  it("positions the now line to the right of all events when nowMs is latest", () => {
    const nowMs = Date.parse("2026-03-16T09:05:00.000Z"); // 4 min after last event
    const layout = buildTimelineLayout(BASE_EVENTS, 1, nowMs);
    const rightmostEvent = Math.max(...layout.items.map((i) => i.left));

    expect(layout.nowLeft).toBeGreaterThanOrEqual(rightmostEvent);
  });

  it("returns nowLeft within canvas width for empty events", () => {
    const nowMs = Date.now();
    const layout = buildTimelineLayout([], 1, nowMs);

    expect(layout.nowLeft).toBeLessThanOrEqual(layout.width);
    expect(layout.nowLeft).toBeGreaterThanOrEqual(0);
  });

  it("attaches upward cross-lane connectors to the nearest card edges", () => {
    const layout = buildTimelineLayout(
      [
        {
          id: "1",
          taskId: "task-1",
          kind: "tool.used",
          lane: "implementation" as const,
          title: "Edit server",
          metadata: {},
          classification: { lane: "implementation" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:00.000Z"
        },
        {
          id: "2",
          taskId: "task-1",
          kind: "context.saved",
          lane: "exploration" as const,
          title: "Read files",
          metadata: {},
          classification: { lane: "exploration" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:01.000Z"
        }
      ],
      1,
      Date.parse("2026-03-16T09:00:05.000Z")
    );

    const connectors = buildTimelineConnectors(layout.items, {
      "1": { left: 300, top: 386, width: 152, height: 84 },
      "2": { left: 540, top: 162, width: 152, height: 84 }
    });

    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({
      cross: true,
      path: "M 376 386 V 316 H 616 V 246",
      sourceEventId: "1",
      targetEventId: "2"
    });
  });

  it("keeps same-lane connectors centered on measured node bounds", () => {
    const layout = buildTimelineLayout(
      [
        {
          id: "1",
          taskId: "task-1",
          kind: "context.saved",
          lane: "user" as const,
          title: "First",
          metadata: {},
          classification: { lane: "user" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:00.000Z"
        },
        {
          id: "2",
          taskId: "task-1",
          kind: "context.saved",
          lane: "user" as const,
          title: "Second",
          metadata: {},
          classification: { lane: "user" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:10.000Z"
        }
      ],
      1,
      Date.parse("2026-03-16T09:00:15.000Z")
    );

    const connectors = buildTimelineConnectors(layout.items, {
      "1": { left: 300, top: 50, width: 152, height: 84 },
      "2": { left: 560, top: 58, width: 152, height: 68 }
    });

    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({
      cross: false,
      path: "M 452 92 H 560",
      sourceEventId: "1",
      targetEventId: "2"
    });
  });
});

describe("buildTimelineLayout - 엣지케이스", () => {
  it("이벤트 없으면 빈 배열을 반환한다", () => {
    const layout = buildTimelineLayout([], 1, Date.now());

    expect(layout.items).toHaveLength(0);
    expect(layout.width).toBe(1200);
  });

  it("단일 이벤트는 items 길이가 1이다", () => {
    const layout = buildTimelineLayout(
      [
        {
          id: "solo",
          taskId: "task-x",
          kind: "tool.used",
          lane: "user" as const,
          title: "Solo",
          metadata: {},
          classification: { lane: "user" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T10:00:00.000Z"
        }
      ],
      1,
      Date.parse("2026-03-16T10:01:00.000Z")
    );

    expect(layout.items).toHaveLength(1);
    expect(layout.items[0]?.event.id).toBe("solo");
  });

  it("zoom이 클수록 캔버스가 더 넓어진다", () => {
    // Need enough events so that events.length * 150 * zoom > 1200 (the minimum)
    // With 10 events: 10 * 150 * 1 = 1500, 10 * 150 * 3 = 4500 → clearly different
    const makeEventAt = (id: string, offsetSec: number) => ({
      id,
      taskId: "t",
      kind: "tool.used",
      lane: "implementation" as const,
      title: id,
      metadata: {},
      classification: { lane: "implementation" as const, tags: [], matches: [] },
      createdAt: new Date(Date.parse("2026-03-16T09:00:00.000Z") + offsetSec * 1000).toISOString()
    });

    const events = Array.from({ length: 10 }, (_, i) => makeEventAt(`e${i}`, i * 10));
    const now = Date.parse("2026-03-16T09:02:00.000Z");
    const small = buildTimelineLayout(events, 1, now);
    const large = buildTimelineLayout(events, 3, now);

    expect(large.width).toBeGreaterThan(small.width);
  });

  it("모든 이벤트의 top이 RULER_HEIGHT 이상이다", () => {
    const events = TIMELINE_LANES.map((lane, idx) => ({
      id: `lane-${idx}`,
      taskId: "t",
      kind: "tool.used",
      lane,
      title: lane,
      metadata: {},
      classification: { lane, tags: [], matches: [] },
      createdAt: new Date(Date.parse("2026-03-16T09:00:00.000Z") + idx * 1000).toISOString()
    }));

    const layout = buildTimelineLayout(events, 1, Date.parse("2026-03-16T09:01:00.000Z"));

    for (const item of layout.items) {
      expect(item.top).toBeGreaterThanOrEqual(RULER_HEIGHT);
    }
  });

  it("레인별로 top 간격이 LANE_HEIGHT만큼 다르다", () => {
    const events = TIMELINE_LANES.map((lane, idx) => ({
      id: `l${idx}`,
      taskId: "t",
      kind: "tool.used",
      lane,
      title: lane,
      metadata: {},
      classification: { lane, tags: [], matches: [] },
      createdAt: new Date(Date.parse("2026-03-16T09:00:00.000Z") + idx * 60000).toISOString()
    }));

    const layout = buildTimelineLayout(events, 1, Date.parse("2026-03-16T09:10:00.000Z"));
    const tops = layout.items.map((item) => item.top);
    const sortedUnique = [...new Set(tops)].sort((a, b) => a - b);

    for (let i = 1; i < sortedUnique.length; i++) {
      const currentTop = sortedUnique[i];
      const previousTop = sortedUnique[i - 1];

      expect(currentTop).toBeDefined();
      expect(previousTop).toBeDefined();
      expect((currentTop ?? 0) - (previousTop ?? 0)).toBe(LANE_HEIGHT);
    }
  });

  it("왼쪽 경계 근처 클러스터도 첫 카드가 gutter 안으로 밀리지 않는다", () => {
    const events = [0, 1, 2].map((offsetSec, index) => ({
      id: `cluster-${index}`,
      taskId: "t",
      kind: "tool.used",
      lane: "user" as const,
      title: `Cluster ${index}`,
      metadata: {},
      classification: { lane: "user" as const, tags: [], matches: [] },
      createdAt: new Date(Date.parse("2026-03-16T09:00:00.000Z") + offsetSec * 1000).toISOString()
    }));

    const layout = buildTimelineLayout(events, 1, Date.parse("2026-03-16T09:05:00.000Z"));
    const firstLeft = Math.min(...layout.items.map((item) => item.left));

    expect(firstLeft).toBeGreaterThanOrEqual(LEFT_GUTTER + NODE_WIDTH / 2);
  });
});

describe("buildTimelineConnectors - 엣지케이스", () => {
  it("단일 이벤트는 연결선이 없다", () => {
    const layout = buildTimelineLayout(
      [
        {
          id: "only",
          taskId: "t",
          kind: "tool.used",
          lane: "user" as const,
          title: "Only",
          metadata: {},
          classification: { lane: "user" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:00.000Z"
        }
      ],
      1,
      Date.parse("2026-03-16T09:01:00.000Z")
    );

    const connectors = buildTimelineConnectors(layout.items, {});
    expect(connectors).toHaveLength(0);
  });

  it("노드 바운드 없이도 추정값으로 연결선 경로를 생성한다", () => {
    const layout = buildTimelineLayout(
      [
        {
          id: "e1",
          taskId: "t",
          kind: "tool.used",
          lane: "exploration" as const,
          title: "Read",
          metadata: {},
          classification: { lane: "exploration" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:00.000Z"
        },
        {
          id: "e2",
          taskId: "t",
          kind: "tool.used",
          lane: "exploration" as const,
          title: "Read 2",
          metadata: {},
          classification: { lane: "exploration" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:30.000Z"
        }
      ],
      1,
      Date.parse("2026-03-16T09:01:00.000Z")
    );

    const connectors = buildTimelineConnectors(layout.items);

    expect(connectors).toHaveLength(1);
    expect(connectors[0]?.path).toBeTruthy();
    expect(connectors[0]?.cross).toBe(false);
  });

  it("노드 바운드 맵의 key가 없어도 fallback 좌표를 사용한다", () => {
    const layout = buildTimelineLayout(
      [
        {
          id: "x1",
          taskId: "t",
          kind: "tool.used",
          lane: "planning" as const,
          title: "Plan",
          metadata: {},
          classification: { lane: "planning" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:00.000Z"
        },
        {
          id: "x2",
          taskId: "t",
          kind: "tool.used",
          lane: "planning" as const,
          title: "Plan 2",
          metadata: {},
          classification: { lane: "planning" as const, tags: [], matches: [] },
          createdAt: "2026-03-16T09:00:45.000Z"
        }
      ],
      1,
      Date.parse("2026-03-16T09:01:00.000Z")
    );

    // Pass bounds for only one of the two nodes
    const connectors = buildTimelineConnectors(layout.items, {
      "x1": { left: 200, top: 242, width: NODE_WIDTH, height: 76 }
    });

    expect(connectors).toHaveLength(1);
    expect(connectors[0]?.sourceEventId).toBe("x1");
    expect(connectors[0]?.targetEventId).toBe("x2");
  });
});

describe("buildTimestampTicks", () => {
  it("이벤트 없으면 빈 배열 반환", () => {
    const layout = buildTimelineLayout([], 1, Date.now());
    const ticks = buildTimestampTicks([], layout, Date.now());

    expect(ticks).toHaveLength(0);
  });

  it("스팬이 0이면 빈 배열 반환", () => {
    const sameTime = "2026-03-16T09:00:00.000Z";
    const event = {
      id: "e",
      taskId: "t",
      kind: "tool.used",
      lane: "user" as const,
      title: "T",
      metadata: {},
      classification: { lane: "user" as const, tags: [], matches: [] },
      createdAt: sameTime
    };
    const nowMs = Date.parse(sameTime); // same as event → span = 0
    const layout = buildTimelineLayout([event], 1, nowMs);
    const ticks = buildTimestampTicks([event], layout, nowMs);

    expect(ticks).toHaveLength(0);
  });

  it("생성된 눈금 레이블이 HH:mm:ss 형식이다", () => {
    const events = [
      {
        id: "e1",
        taskId: "t",
        kind: "tool.used",
        lane: "user" as const,
        title: "T",
        metadata: {},
        classification: { lane: "user" as const, tags: [], matches: [] },
        createdAt: "2026-03-16T09:00:00.000Z"
      }
    ];
    const nowMs = Date.parse("2026-03-16T09:05:00.000Z");
    const layout = buildTimelineLayout(events, 1, nowMs);
    const ticks = buildTimestampTicks(events, layout, nowMs);

    for (const tick of ticks) {
      expect(tick.label).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
  });
});

describe("formatRelativeTime", () => {
  it("1분 미만이면 'just now' 반환", () => {
    // Use 10 seconds ago — Math.round(10000/60000) = 0 < 1, so "just now"
    const recent = new Date(Date.now() - 10_000).toISOString();

    expect(formatRelativeTime(recent)).toBe("just now");
  });

  it("60분 미만이면 'Nm ago' 형식 반환", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("24시간 미만이면 'Nh ago' 형식 반환", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();

    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
  });

  it("24시간 이상이면 'Nd ago' 형식 반환", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();

    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });
});
