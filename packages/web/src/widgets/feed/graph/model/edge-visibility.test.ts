import { describe, expect, it } from "vitest";
import type { FeedEdge } from "~web/widgets/feed/graph/model/edges.js";
import {
  filterGraphEdges,
  type GraphEdgeNode,
} from "~web/widgets/feed/graph/model/edge-visibility.js";

function node(
  id: string,
  overrides: Partial<Omit<GraphEdgeNode, "id">> = {},
): GraphEdgeNode {
  return { id, leftPercent: 10, laneIdx: 0, yOffset: 0, ...overrides };
}

describe("filterGraphEdges", () => {
  const causal: FeedEdge = {
    kind: "causal",
    fromEventId: "from",
    toEventId: "to",
  };

  it("표시 중이지 않은 끝점을 가진 엣지를 제외한다", () => {
    const nodes = [node("from"), node("to", { laneIdx: 1 })];
    expect(filterGraphEdges([causal], nodes, new Set(["from"]))).toEqual([]);
  });

  it("같은 레인을 잇는 엣지를 제외한다", () => {
    const nodes = [node("from"), node("to", { leftPercent: 15 })];
    expect(filterGraphEdges([causal], nodes, new Set(["from", "to"]))).toEqual([]);
  });

  it("세로 간격이 30픽셀 미만인 엣지를 제외한다", () => {
    const nodes = [
      node("from", { yOffset: 22 }),
      node("to", { laneIdx: 1, yOffset: -22 }),
    ];
    expect(filterGraphEdges([causal], nodes, new Set(["from", "to"]))).toEqual([]);
  });

  it("가로 폭의 20퍼센트를 넘는 인과 엣지만 제외한다", () => {
    const nodes = [
      node("from", { leftPercent: 10 }),
      node("to", { leftPercent: 31, laneIdx: 1 }),
    ];
    const explicit: FeedEdge = { ...causal, kind: "explicit" };
    expect(filterGraphEdges([causal, explicit], nodes, new Set(["from", "to"])))
      .toEqual([explicit]);
  });

  it("충분히 떨어진 교차 레인의 짧은 인과 엣지를 유지한다", () => {
    const nodes = [
      node("from", { leftPercent: 10 }),
      node("to", { leftPercent: 30, laneIdx: 1 }),
    ];
    expect(filterGraphEdges([causal], nodes, new Set(["from", "to"]))).toEqual([causal]);
  });
});
