import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { TaskListHeader } from "~web/widgets/task-list/TaskListHeader.js";

vi.mock("~web/entities/task-cleanup/api/queries.js", () => ({
  useTaskCleanupSuggestionsQuery: vi.fn(() => ({ data: { suggestions: [] } })),
}));

vi.mock("~web/widgets/task-list/TaskCleanupModal.js", () => ({
  TaskCleanupModal: ({ open }: { readonly open: boolean }) => (
    <div data-testid="task-cleanup-modal" data-open={String(open)} />
  ),
}));

describe("TaskListHeader", () => {
  test("정리 모달을 열기 전에는 모달 컴포넌트를 마운트하지 않는다", () => {
    renderWithProviders(<TaskListHeader />);

    expect(screen.queryByTestId("task-cleanup-modal")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open task cleanup" }));

    expect(screen.getByTestId("task-cleanup-modal").getAttribute("data-open"))
      .toBe("true");
  });
});

function renderWithProviders(children: ReactNode) {
  const store = createUiStore({ persisted: false });

  return render(
    <TooltipProvider>
      <UiStoreProvider store={store}>{children}</UiStoreProvider>
    </TooltipProvider>,
  );
}
