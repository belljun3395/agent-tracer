import { describe, expect, it } from "vitest";

import { EventId, TaskId } from "@monitor/core";
import type { TimelineEvent } from "../types.js";
import {
  TIMELINE_LANES,
  buildTimelineConnectors,
  buildTimelineContextSummary,
  buildTimelineLayout,
  buildTimelineRelations,
  buildTimestampTicks,
  resolveTimelineViewportHeight
} from "./timeline.js";

type EventOverrides = Omit<Partial<TimelineEvent>, "id" | "taskId"> & { id?: string; taskId?: string };

function makeEvent(overrides: EventOverrides = {}): TimelineEvent {
  const { id, taskId, ...rest } = overrides;
  return {
    id: EventId(id ?? "event-1"),
    taskId: TaskId(taskId ?? "task-1"),
    kind: rest.kind ?? "tool.used",
    lane: rest.lane ?? "implementation",
    title: rest.title ?? "이벤트",
    metadata: rest.metadata ?? {},
    classification: rest.classification ?? {
      lane: rest.lane ?? "implementation",
      tags: [],
      matches: []
    },
    createdAt: rest.createdAt ?? "2026-03-16T09:00:00.000Z",
    ...rest
  };
}

describe("buildTimelineLayout", () => {
  it("시간과 레인에 따라 이벤트 카드를 분리해서 배치한다", () => {
    const layout = buildTimelineLayout([
      makeEvent({
        id: "explore",
        lane: "exploration",
        title: "파일 읽기",
        createdAt: "2026-03-16T09:00:00.000Z"
      }),
      makeEvent({
        id: "verify",
        kind: "verification.logged",
        lane: "implementation",
        title: "테스트 실행",
        createdAt: "2026-03-16T09:01:00.000Z"
      })
    ], 1, Date.parse("2026-03-16T09:02:00.000Z"));

    expect(layout.items).toHaveLength(2);
    expect(layout.items[0]!.left).toBeLessThan(layout.items[1]!.left);
    expect(layout.items[0]!.top).not.toBe(layout.items[1]!.top);
    expect(layout.nowLeft).toBeLessThanOrEqual(layout.width);
  });
});

describe("buildTimelineRelations", () => {
  it("parentEventId가 있으면 명시적 관계를 우선 만든다", () => {
    const relations = buildTimelineRelations([
      makeEvent({
        id: "todo-added",
        kind: "todo.logged",
        lane: "todos",
        title: "할 일 추가",
        metadata: { todoId: "todo-1" }
      }),
      makeEvent({
        id: "implement",
        kind: "action.logged",
        lane: "implementation",
        title: "구현",
        metadata: {
          parentEventId: "todo-added",
          relationType: "implements",
          relationLabel: "할 일 구현",
          workItemId: "todo-1"
        }
      })
    ]);

    expect(relations).toEqual([
      expect.objectContaining({
        sourceEventId: "todo-added",
        targetEventId: "implement",
        relationType: "implements",
        isExplicit: true
      })
    ]);
  });
});

describe("buildTimelineConnectors", () => {
  it("명시적 관계가 있으면 그 의미를 가진 연결선을 만든다", () => {
    const events = [
      makeEvent({
        id: "todo-added",
        kind: "todo.logged",
        lane: "todos",
        title: "할 일 추가",
        metadata: { todoId: "todo-1" }
      }),
      makeEvent({
        id: "implement",
        kind: "action.logged",
        lane: "implementation",
        title: "구현",
        metadata: {
          parentEventId: "todo-added",
          relationType: "implements",
          relationLabel: "할 일 구현",
          workItemId: "todo-1"
        },
        createdAt: "2026-03-16T09:00:05.000Z"
      })
    ];

    const layout = buildTimelineLayout(events, 1, Date.parse("2026-03-16T09:00:10.000Z"));
    const connectors = buildTimelineConnectors(layout.items);

    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({
      relationType: "implements",
      label: "할 일 구현",
      isExplicit: true,
      workItemId: "todo-1"
    });
  });

  it("명시적 관계가 없으면 시간순 fallback 연결선을 만든다", () => {
    const layout = buildTimelineLayout([
      makeEvent({
        id: "first",
        lane: "planning",
        title: "계획 수립"
      }),
      makeEvent({
        id: "second",
        lane: "planning",
        title: "구현 시작",
        createdAt: "2026-03-16T09:00:05.000Z"
      })
    ], 1, Date.parse("2026-03-16T09:00:10.000Z"));

    const connectors = buildTimelineConnectors(layout.items);

    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({
      relationType: "relates_to",
      label: "sequence",
      isExplicit: false,
      sourceEventId: "first",
      targetEventId: "second"
    });
  });
});

describe("보조 요약 유틸", () => {
  it("현재 필터 상태를 사람이 읽을 수 있는 문장으로 요약한다", () => {
    expect(buildTimelineContextSummary({
      filteredEventCount: 2,
      totalEventCount: 9,
      activeLaneCount: 4,
      totalLaneCount: TIMELINE_LANES.length,
      selectedRuleId: "backend",
      selectedTag: null,
      showRuleGapsOnly: false
    })).toEqual({
      eventSummary: "2/9 events",
      laneSummary: `4/${TIMELINE_LANES.length} lanes`,
      focusSummary: "Rule: backend"
    });
  });

  it("뷰포트 높이는 내용 높이와 선호 최대치 중 작은 값을 사용한다", () => {
    expect(resolveTimelineViewportHeight(896, 704)).toBe(704);
    expect(resolveTimelineViewportHeight(512, 704)).toBe(512);
  });

  it("타임스탬프 눈금은 HH:mm:ss 형식으로 만든다", () => {
    const events = [
      makeEvent({
        id: "first",
        createdAt: "2026-03-16T09:00:00.000Z"
      }),
      makeEvent({
        id: "second",
        createdAt: "2026-03-16T09:05:00.000Z"
      })
    ];
    const layout = buildTimelineLayout(events, 1, Date.parse("2026-03-16T09:06:00.000Z"));
    const ticks = buildTimestampTicks(events, layout, Date.parse("2026-03-16T09:06:00.000Z"));

    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every((tick) => /^\d{2}:\d{2}:\d{2}$/.test(tick.label))).toBe(true);
  });
});
