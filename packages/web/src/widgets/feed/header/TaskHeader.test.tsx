import { KIND } from "@monitor/kernel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskId, TaskSlug, WorkspacePath } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { TaskHeader } from "~web/widgets/feed/header/TaskHeader.js";

afterEach(cleanup);

describe("TaskHeader", () => {
  it("테스크 상세 뷰 전환에서 overview 탭을 노출하지 않는다", () => {
    renderHeader([]);

    expect(screen.getByRole("button", { name: "feed view" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "graph view" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "overview view" })).toBeNull();
  });

  it("이벤트가 있으면 레인 선택을 sticky 헤더 안에 노출한다", () => {
    const store = renderHeader([makeEvent()]);

    const lanesLabel = screen.getByText("Lanes");
    const stickyHeader = screen
      .getByRole("button", { name: "Edit task title: 테스트 작업" })
      .closest(".sticky");
    expect(stickyHeader?.contains(lanesLabel)).toBe(true);

    const implementation = screen.getByRole("button", { name: "IMPL" });
    expect(implementation.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(implementation);
    expect(implementation.getAttribute("aria-pressed")).toBe("false");
    expect(store.getState().visibleLanes).not.toContain("impl");
  });

  it("이벤트가 없으면 레인 선택을 노출하지 않는다", () => {
    renderHeader([]);

    expect(screen.queryByText("Lanes")).toBeNull();
  });
});

function renderHeader(timeline: readonly TimelineEventRecord[]) {
  const queryClient = new QueryClient();
  const store = createUiStore({ persisted: false });

  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UiStoreProvider store={store}>
          <TaskHeader task={makeTask()} timeline={timeline} />
        </UiStoreProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );

  return store;
}

function makeTask(): MonitoringTask {
  return {
    id: TaskId("task-1"),
    title: "테스트 작업",
    slug: TaskSlug("test-task"),
    workspacePath: WorkspacePath("/tmp/agent-tracer"),
    status: "running",
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
  };
}

function makeEvent(): TimelineEventRecord {
  return {
    id: "event-1" as TimelineEventRecord["id"],
    taskId: TaskId("task-1"),
    kind: KIND.userMessage,
    lane: "user",
    title: "User prompt",
    metadata: {},
    classification: { lane: "user", tags: [] },
    createdAt: "2026-07-07T00:00:01.000Z",
  };
}
