import { KIND } from "@monitor/kernel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventSearchHit, TaskSearchHit } from "~web/features/search/model/search.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/overlays/Tooltip.js";
import { SearchResultsPanel } from "~web/widgets/task-list/search/SearchResultsPanel.js";

const TASK_HIT: TaskSearchHit = {
  id: "task-hit-1",
  taskId: "task-1",
  title: "Task one",
  status: "completed",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const EVENT_HIT: EventSearchHit = {
  id: "event-hit-1",
  eventId: "event-1",
  taskId: "task-2",
  taskTitle: "Other task",
  title: "Event one",
  lane: "implementation",
  kind: KIND.actionLogged,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const useSearchQueryMock = vi.hoisted(() => vi.fn());

vi.mock("~web/features/search/api/queries.js", () => ({
  useSearchQuery: useSearchQueryMock,
}));

beforeEach(() => {
  useSearchQueryMock.mockReset();
  useSearchQueryMock.mockImplementation((searchType: "tasks" | "events") => ({
    data: searchType === "tasks" ? { tasks: [TASK_HIT], events: [] } : { tasks: [], events: [EVENT_HIT] },
    isLoading: false,
    isError: false,
    isFetching: false,
  }));
});

afterEach(() => cleanup());

describe("SearchResultsPanel", () => {
  it("기본값은 tasks이며 태스크 섹션만 조회하고 보여준다", () => {
    renderPanel();

    expect(useSearchQueryMock).toHaveBeenCalledWith("tasks", "bug", undefined);
    expect(screen.getByText("Task one")).toBeTruthy();
    expect(screen.queryByText("Event one")).toBeNull();
  });

  it("Events 토글을 누르면 이벤트 섹션만 조회하고 보여준다", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Events" }));

    expect(useSearchQueryMock).toHaveBeenLastCalledWith("events", "bug", undefined);
    expect(screen.getByText("Event one")).toBeTruthy();
    expect(screen.queryByText("Task one")).toBeNull();
  });

  it("scope 토글은 type 토글과 독립적으로 계속 렌더링된다", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "This task" })).toBeTruthy();
  });
});

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createUiStore({ persisted: false });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <UiStoreProvider store={store}>
          <TooltipProvider>
            <SearchResultsPanel query="bug" />
          </TooltipProvider>
        </UiStoreProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
