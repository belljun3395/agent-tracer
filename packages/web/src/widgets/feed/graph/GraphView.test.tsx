import { KIND } from "@monitor/kernel";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventId, TaskId } from "~web/shared/identity.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { GraphView } from "~web/widgets/feed/graph/GraphView.js";

afterEach(cleanup);

describe("GraphView", () => {
  it("빈 레인을 기본으로 숨기고 사용자가 전체 레인을 펼칠 수 있게 한다", () => {
    renderGraph();

    expect(screen.getByText("IMPL")).not.toBeNull();
    expect(screen.queryByText("USER")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "+7 empty lanes" }));

    expect(screen.getByText("USER")).not.toBeNull();
    expect(screen.getByRole("button", { name: "all lanes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("확대와 초기화를 같은 그래프 viewport에 반영한다", () => {
    renderGraph();

    expect(screen.getByText("8.0×")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("12.0×")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByText("8.0×")).not.toBeNull();
  });

  it("보조키 휠 확대를 포인터가 속한 viewport에 적용한다", () => {
    renderGraph();
    const viewport = screen.getByRole("region", { name: "Graph viewport" });
    const content = viewport.firstElementChild as HTMLElement;

    expect(Number.parseFloat(content.style.width)).toBe(800);

    fireEvent.wheel(viewport, {
      ctrlKey: true,
      deltaY: -100,
      clientX: 50,
    });

    expect(Number.parseFloat(content.style.width)).toBeCloseTo(920, 5);
  });

  it("이벤트 노드를 그래프 plot에 표시한다", () => {
    renderGraph();

    expect(screen.getByRole("button", { name: "테스트 실행" })).not.toBeNull();
  });
});

function renderGraph(): void {
  const store = createUiStore({ persisted: false });
  render(
    <UiStoreProvider store={store}>
      <TooltipProvider>
        <GraphView
          events={[makeEvent()]}
          verifications={[]}
          taskStatus="completed"
        />
      </TooltipProvider>
    </UiStoreProvider>,
  );
}

function makeEvent(): TimelineEventRecord {
  return {
    id: EventId("event-1"),
    taskId: TaskId("task-1"),
    kind: KIND.executeTool,
    lane: "implementation",
    title: "테스트 실행",
    metadata: {},
    classification: { lane: "implementation", tags: [] },
    createdAt: "2026-07-10T09:20:00.000Z",
  };
}
