import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { RuntimeSource, TaskId, TaskSlug } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { createUiStore, UiStoreProvider, type UiStoreApi } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { TaskRow } from "~web/widgets/task-list/row/TaskRow.js";

const mutations = vi.hoisted(() => ({
  archive: {
    isPending: false,
    isError: false,
    variables: undefined,
    mutate: vi.fn(),
  },
  delete: {
    isPending: false,
    isError: false,
    variables: undefined,
    mutate: vi.fn(),
  },
  unarchive: {
    isPending: false,
    isError: false,
    variables: undefined,
    mutate: vi.fn(),
  },
}));

vi.mock("~web/entities/task/api/lifecycle-mutations.js", () => ({
  useArchiveTaskMutation: () => mutations.archive,
  useDeleteTaskMutation: () => mutations.delete,
  useUnarchiveTaskMutation: () => mutations.unarchive,
}));

vi.mock("~web/entities/tag/api/queries.js", () => ({
  useTaskTagsQuery: () => ({ data: undefined, isLoading: false }),
}));

beforeEach(() => {
  mutations.archive.mutate.mockClear();
  mutations.delete.mutate.mockClear();
  mutations.unarchive.mutate.mockClear();
});

afterEach(() => cleanup());

describe("태스크 목록 행", () => {
  it("하위 에이전트 토글은 태스크로 이동하지 않고 계층 상태만 바꾼다", () => {
    const { store } = renderTaskRow({ hasChildren: true });

    fireEvent.click(screen.getByRole("button", { name: "Collapse subagents" }));

    expect(store.getState().collapsedParents).toEqual([TaskId("task-1")]);
    expect(screen.getByLabelText("현재 경로").textContent).toBe("/tasks");
  });

  it("활성 태스크를 보관한 뒤 목록으로 이동한다", () => {
    const task = makeTask();
    renderTaskRow({
      task,
      initialEntry: `/tasks/${task.id}`,
      selectedTaskId: task.id,
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive task" }));

    expect(mutations.archive.mutate).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const options = mutations.archive.mutate.mock.calls[0]?.[1] as {
      readonly onSuccess: () => void;
    };
    act(() => options.onSuccess());
    expect(screen.getByLabelText("현재 경로").textContent).toBe("/tasks");
  });

  it("숨기기는 두 번째 클릭에서만 실행한다", () => {
    const task = makeTask();
    renderTaskRow({ task });

    fireEvent.click(screen.getByRole("button", { name: "Hide task" }));
    expect(mutations.delete.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm hide" }));
    expect(mutations.delete.mutate).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("보관된 태스크는 복원 액션을 사용한다", () => {
    const task = makeTask({ archived: true });
    renderTaskRow({ task });

    fireEvent.click(screen.getByRole("button", { name: "Unarchive task" }));

    expect(mutations.unarchive.mutate).toHaveBeenCalledWith(task.id);
    expect(mutations.archive.mutate).not.toHaveBeenCalled();
  });
});

function renderTaskRow({
  task = makeTask(),
  initialEntry = "/tasks",
  hasChildren = false,
  selectedTaskId,
}: {
  readonly task?: MonitoringTask;
  readonly initialEntry?: string;
  readonly hasChildren?: boolean;
  readonly selectedTaskId?: MonitoringTask["id"];
} = {}): { readonly store: UiStoreApi } {
  const store = createUiStore({ persisted: false });
  if (selectedTaskId !== undefined) {
    store.getState().setSelectedTaskId(selectedTaskId);
  }
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UiStoreProvider store={store}>
        <TooltipProvider>
          <TaskRow
            task={task}
            unread={false}
            depth={1}
            hasChildren={hasChildren}
            collapsed={false}
            hideRuntimeBadge={false}
            nowMs={Date.parse("2026-07-13T00:00:00.000Z")}
          />
          <LocationProbe />
        </TooltipProvider>
      </UiStoreProvider>
    </MemoryRouter>,
  );
  return { store };
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="현재 경로">{location.pathname}</output>;
}

function makeTask(overrides: Partial<MonitoringTask> = {}): MonitoringTask {
  return {
    id: TaskId("task-1"),
    title: "테스트 작업",
    slug: TaskSlug("test-task"),
    status: "running",
    runtimeSource: RuntimeSource("codex"),
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}
