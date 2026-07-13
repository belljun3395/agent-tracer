import { KIND } from "@monitor/kernel";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "~web/shared/identity.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { laneThemeForKey } from "~web/entities/task/model/lane-theme.js";
import { GraphNode } from "~web/widgets/feed/graph/plot/GraphNode.js";
import type { PositionedNode } from "~web/widgets/feed/graph/model/node-layout.js";

describe("GraphNode", () => {
  it("원본 이벤트 ID를 선택하고 연결된 검증 개수를 배지로 표시한다", () => {
    const store = createUiStore({ persisted: false });
    const node = makeNode([verification("verification-1"), verification("verification-2")]);

    render(
      <UiStoreProvider store={store}>
        <GraphNode node={node} />
      </UiStoreProvider>,
    );

    const button = screen.getByRole("button", {
      name: "테스트 실행 · 2 verified rules",
    });
    expect(screen.getByText("✓2")).not.toBeNull();

    fireEvent.click(button);

    expect(store.getState().selectedEventId).toBe("event-1");
  });
});

function makeNode(verifications: readonly TaskVerification[]): PositionedNode {
  const event: TimelineEventRecord = {
    id: EventId("event-1"),
    taskId: TaskId("task-1"),
    kind: KIND.executeTool,
    lane: "implementation",
    title: "테스트 실행",
    metadata: {},
    classification: { lane: "implementation", tags: [] },
    createdAt: "2026-07-10T09:20:00.000Z",
  };
  return {
    id: event.id,
    leftPercent: 50,
    laneIdx: 0,
    vm: {
      event,
      lane: laneThemeForKey("veri"),
      clockLabel: "18:20:00",
      offsetLabel: "+0s",
      toolName: event.title,
      subtypeLabel: null,
      bodyText: null,
      hasViolation: false,
      paths: [],
      tokens: null,
    },
    yOffset: 0,
    dense: false,
    verification: { moveToVeri: true, verifications },
  };
}

function verification(id: string): TaskVerification {
  return {
    id,
    taskId: "task-1",
    ruleId: `rule-${id}`,
    ruleName: id,
    turnId: "turn-1",
    evaluatedAt: "2026-07-10T09:30:00.000Z",
    matchedEventIds: ["event-1"],
  };
}
