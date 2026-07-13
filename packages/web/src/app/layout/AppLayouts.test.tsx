import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CompactAppLayout } from "~web/app/layout/CompactAppLayout.js";
import { WideAppLayout } from "~web/app/layout/WideAppLayout.js";

vi.mock("~web/widgets/topbar/index.js", () => ({
  TopBar: ({ viewport }: { readonly viewport: string }) => <div>Top {viewport}</div>,
}));
vi.mock("~web/widgets/task-list/index.js", () => ({
  TaskListPanel: () => <div>Task list</div>,
}));
vi.mock("~web/widgets/inspector/index.js", () => ({
  InspectorPanel: () => <div>Inspector panel</div>,
}));
vi.mock("./ResizeHandle.js", () => ({
  ResizeHandle: () => <div>Resize</div>,
}));
vi.mock("./PanelRail.js", () => ({
  CollapsedPanelRail: () => <div>Collapsed rail</div>,
  CollapsePanelTab: () => <div>Collapse tab</div>,
}));

describe("뷰포트별 앱 레이아웃", () => {
  it("넓은 화면은 태스크 목록을 유지하고 선택 전 검사기를 숨긴다", () => {
    render(
      <MemoryRouter>
        <WideAppLayout
          wsConnected={false}
          inspectorAvailable={false}
          sidebarWidth={280}
          inspectorWidth={360}
          sidebarCollapsed={false}
          inspectorCollapsed={false}
          onSidebarWidthChange={vi.fn()}
          onInspectorWidthChange={vi.fn()}
          onSidebarCollapsedChange={vi.fn()}
          onInspectorCollapsedChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Top wide")).toBeInTheDocument();
    expect(screen.getByText("Task list")).toBeInTheDocument();
    expect(screen.queryByText("Inspector panel")).not.toBeInTheDocument();
  });

  it("모바일 화면은 태스크와 검사기를 각각 시트로 연다", () => {
    render(
      <MemoryRouter>
        <CompactAppLayout
          viewport="mobile"
          wsConnected
          inspectorAvailable
          sidebarWidth={280}
          inspectorWidth={360}
          sidebarDrawerOpen
          inspectorDrawerOpen
          onSidebarWidthChange={vi.fn()}
          onSidebarDrawerOpenChange={vi.fn()}
          onInspectorDrawerOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("dialog", { name: "Task list" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Inspector" })).toBeInTheDocument();
  });
});
