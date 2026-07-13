import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskId } from "~web/shared/identity.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TaskPicker } from "~web/widgets/recipes/scan/TaskPicker.js";

afterEach(cleanup);

describe("레시피 스캔 태스크 선택기", () => {
  it("태스크 목록을 스크롤 컨테이너 밖의 포털에 표시한다", () => {
    renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Select a completed task…" }));

    const dialog = screen.getByRole("dialog", { name: "Completed tasks" });
    expect(dialog.parentElement).toBe(document.body);
    expect(
      screen.getByRole("listbox", { name: "Completed task options" }),
    ).toBeTruthy();
  });

  it("Escape를 누르면 열린 태스크 목록을 닫는다", () => {
    renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Select a completed task…" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Completed tasks" })).toBeNull();
  });

  it("포털 내부 옵션을 조작해도 팝업을 유지한다", () => {
    const onIncludeArchivedChange = vi.fn();
    renderPicker(onIncludeArchivedChange);

    fireEvent.click(screen.getByRole("button", { name: "Select a completed task…" }));
    const checkbox = screen.getByRole("checkbox", {
      name: "Include archived tasks",
    });
    fireEvent.pointerDown(checkbox);
    fireEvent.click(checkbox);

    expect(onIncludeArchivedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("dialog", { name: "Completed tasks" })).toBeTruthy();
  });

  it("외부를 누르면 열린 태스크 목록을 닫는다", () => {
    renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Select a completed task…" }));
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("dialog", { name: "Completed tasks" })).toBeNull();
  });
});

function renderPicker(onIncludeArchivedChange = vi.fn()) {
  const store = createUiStore({ persisted: false });
  return render(
    <UiStoreProvider store={store}>
      <TaskPicker
        tasks={[]}
        loading={false}
        selectedTaskId={null}
        onSelect={vi.fn<(taskId: TaskId) => void>()}
        scannedTaskIds={new Set()}
        includeArchived={false}
        onIncludeArchivedChange={onIncludeArchivedChange}
        disabled={false}
      />
    </UiStoreProvider>,
  );
}
