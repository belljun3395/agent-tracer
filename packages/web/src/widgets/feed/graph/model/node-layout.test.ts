import { KIND } from "@monitor/kernel";
import { describe, expect, test } from "vitest";
import type { EventId } from "~web/shared/identity.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import {
  GRAPH_LANE_KEYS,
  latestGraphNode,
  layoutGraphNodes,
} from "~web/widgets/feed/graph/model/node-layout.js";
import type { TimeRange } from "~web/widgets/feed/graph/model/time-range.js";

function makeEvent(overrides: {
  readonly id: string;
  readonly createdAt: string;
  readonly lane?: TimelineEventRecord["lane"];
  readonly kind?: TimelineEventRecord["kind"];
}): TimelineEventRecord {
  const lane = overrides.lane ?? "implementation";
  return {
    id: overrides.id as EventId,
    taskId: "task-1" as TimelineEventRecord["taskId"],
    kind: overrides.kind ?? KIND.actionLogged,
    lane,
    title: `event ${overrides.id}`,
    metadata: {},
    classification: { lane, tags: [] },
    createdAt: overrides.createdAt,
  };
}

describe("layoutGraphNodes", () => {
  const range: TimeRange = { minMs: 0, maxMs: 100_000, spanMs: 100_000 };

  test("빈 입력은 노드를 만들지 않는다", () => {
    expect(layoutGraphNodes([], range)).toEqual([]);
  });

  test("결정적이다 — 같은 입력은 같은 출력을 낸다", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "1970-01-01T00:00:10.000Z", lane: "user" }),
      makeEvent({ id: "b", createdAt: "1970-01-01T00:00:50.000Z", lane: "implementation" }),
    ];
    const first = layoutGraphNodes(events, range);
    const second = layoutGraphNodes(events, range);
    expect(second).toEqual(first);
  });

  test("숨겨진 레인(background)의 이벤트는 완전히 제외된다", () => {
    const events = [makeEvent({ id: "a", createdAt: "1970-01-01T00:00:10.000Z", lane: "background" })];
    expect(layoutGraphNodes(events, range)).toEqual([]);
  });

  test("laneIdx는 주어진 laneKeys 기준으로 계산되며, 레인이 걸러지면 연속으로 재배치된다", () => {
    const events = [makeEvent({ id: "a", createdAt: "1970-01-01T00:00:10.000Z", lane: "rule" })];
    // "rule"은 LaneKey "rule"에 매핑되며 GRAPH_LANE_KEYS에서는 보통 인덱스 4다.
    const filteredKeys = GRAPH_LANE_KEYS.filter((k) => k !== "user");
    const out = layoutGraphNodes(events, range, filteredKeys);
    expect(out).toHaveLength(1);
    expect(out[0]!.laneIdx).toBe(filteredKeys.indexOf("rule"));
  });

  test("같은 레인에서 멀리 떨어진 노드는 충돌하지 않는다(yOffset 없음, dense 아님)", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "1970-01-01T00:00:00.000Z", lane: "implementation" }),
      makeEvent({ id: "b", createdAt: "1970-01-01T00:01:00.000Z", lane: "implementation" }),
    ];
    const out = layoutGraphNodes(events, range);
    for (const node of out) {
      expect(node.yOffset).toBe(0);
      expect(node.dense).toBe(false);
    }
  });

  test("같은 레인에서 충돌 임계값 이내의 노드는 엇갈리게 배치되고 dense로 표시된다", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "1970-01-01T00:00:10.000Z", lane: "implementation" }),
      makeEvent({ id: "b", createdAt: "1970-01-01T00:00:10.500Z", lane: "implementation" }),
    ];
    const out = layoutGraphNodes(events, range);
    const [first, second] = out;
    expect(first!.dense).toBe(true);
    expect(second!.dense).toBe(true);
    // 겹치지 않음 불변식: 충돌하는 노드는 같은 yOffset을 가질 수 없다.
    expect(second!.yOffset).not.toBe(first!.yOffset);
  });

  test("다른 레인의 노드는 같은 타임스탬프에서도 서로 충돌하지 않는다", () => {
    const events = [
      makeEvent({ id: "a", createdAt: "1970-01-01T00:00:10.000Z", lane: "user" }),
      makeEvent({ id: "b", createdAt: "1970-01-01T00:00:10.000Z", lane: "implementation" }),
    ];
    const out = layoutGraphNodes(events, range);
    for (const node of out) {
      expect(node.dense).toBe(false);
    }
  });

  test("검증 overlay는 원본 이벤트를 VERI 레인으로 옮기고 부재 조건 anchor는 원래 레인에 둔다", () => {
    const matched = makeEvent({
      id: "matched",
      createdAt: "1970-01-01T00:00:10.000Z",
      lane: "implementation",
    });
    const absenceAnchor = makeEvent({
      id: "anchor",
      createdAt: "1970-01-01T00:00:20.000Z",
      lane: "user",
    });
    const matchedVerification = {
      id: "verification-matched",
      taskId: "task-1",
      ruleId: "rule-matched",
      ruleName: "테스트 실행",
      turnId: "turn-1",
      evaluatedAt: "1970-01-01T00:00:30.000Z",
      matchedEventIds: ["matched"],
    };
    const absenceVerification = {
      id: "verification-absence",
      taskId: "task-1",
      ruleId: "rule-absence",
      ruleName: "금지 명령 미사용",
      turnId: "turn-1",
      evaluatedAt: "1970-01-01T00:00:30.000Z",
      matchedEventIds: [],
    };
    const overlay = new Map([
      ["matched", { moveToVeri: true, verifications: [matchedVerification] }],
      ["anchor", { moveToVeri: false, verifications: [absenceVerification] }],
    ]);

    const out = layoutGraphNodes([matched, absenceAnchor], range, GRAPH_LANE_KEYS, overlay);

    expect(out.find((node) => node.id === "matched")?.vm.lane.key).toBe("veri");
    expect(out.find((node) => node.id === "anchor")?.vm.lane.key).toBe("user");
    expect(out.find((node) => node.id === "anchor")?.verification?.verifications).toHaveLength(1);
  });

  test("최신 노드는 입력 배열의 마지막이 아니라 이벤트 시각으로 고른다", () => {
    const nodes = layoutGraphNodes(
      [
        makeEvent({ id: "latest", createdAt: "1970-01-01T00:01:00.000Z" }),
        makeEvent({ id: "older-tail", createdAt: "1970-01-01T00:00:10.000Z" }),
      ],
      range,
    );

    expect(latestGraphNode(nodes)?.id).toBe("latest");
  });
});
