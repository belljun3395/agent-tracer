import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskId, TaskSlug, WorkspacePath } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { TaskHeader } from "~web/widgets/feed/header/TaskHeader.js";

describe("TaskHeader", () => {
  it("테스크 상세 뷰 전환에서 overview 탭을 노출하지 않는다", () => {
    const queryClient = new QueryClient();
    const store = createUiStore({ persisted: false });

    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <UiStoreProvider store={store}>
            <TaskHeader task={makeTask()} timeline={[]} />
          </UiStoreProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "feed view" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "graph view" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "overview view" })).toBeNull();
  });
});

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
