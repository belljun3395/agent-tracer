import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { InspectorPanel } from "~web/widgets/inspector/index.js";
import { TaskListPanel } from "~web/widgets/task-list/index.js";
import { TopBar } from "~web/widgets/topbar/index.js";
import { COLLAPSED_RAIL_WIDTH } from "~web/shared/store/slices/layoutSlice.js";
import { CollapsePanelTab, CollapsedPanelRail } from "~web/app/layout/PanelRail.js";
import { ResizeHandle } from "~web/app/layout/ResizeHandle.js";

// Inspector의 Rules 탭은 다른 위젯 슬라이스라 조립부인 여기서 주입한다.
const RulesTab = lazy(() =>
  import("~web/widgets/rules/index.js").then((m) => ({ default: m.RulesTab })),
);

interface WideAppLayoutProps {
  readonly wsConnected: boolean;
  readonly inspectorAvailable: boolean;
  readonly sidebarWidth: number;
  readonly inspectorWidth: number;
  readonly sidebarCollapsed: boolean;
  readonly inspectorCollapsed: boolean;
  readonly onSidebarWidthChange: (width: number) => void;
  readonly onInspectorWidthChange: (width: number) => void;
  readonly onSidebarCollapsedChange: (collapsed: boolean) => void;
  readonly onInspectorCollapsedChange: (collapsed: boolean) => void;
}

/** 넓은 뷰포트의 태스크·본문·검사기 3열을 조합한다. */
export function WideAppLayout({
  wsConnected,
  inspectorAvailable,
  sidebarWidth,
  inspectorWidth,
  sidebarCollapsed,
  inspectorCollapsed,
  onSidebarWidthChange,
  onInspectorWidthChange,
  onSidebarCollapsedChange,
  onInspectorCollapsedChange,
}: WideAppLayoutProps) {
  const sidebarColumnWidth = sidebarCollapsed ? COLLAPSED_RAIL_WIDTH : sidebarWidth;
  const inspectorColumnWidth = inspectorCollapsed ? COLLAPSED_RAIL_WIDTH : inspectorWidth;

  return (
    <div
      className="grid h-screen min-h-0 overflow-hidden bg-canvas text-ink"
      style={{
        gridTemplateColumns: inspectorAvailable
          ? `${sidebarColumnWidth}px minmax(0, 1fr) ${inspectorColumnWidth}px`
          : `${sidebarColumnWidth}px minmax(0, 1fr)`,
        gridTemplateRows: "48px 1fr",
      }}
    >
      <header className="border-b border-hair" style={{ gridColumn: inspectorAvailable ? "1 / 4" : "1 / 3" }}>
        <TopBar wsConnected={wsConnected} viewport="wide" />
      </header>

      {sidebarCollapsed ? (
        <CollapsedPanelRail side="left" label="Show task list" onAction={() => onSidebarCollapsedChange(false)} />
      ) : (
        <aside className="relative border-r border-hair min-h-0 overflow-hidden" style={{ gridColumn: "1 / 2" }}>
          <TaskListPanel />
          <CollapsePanelTab side="left" label="Hide task list" onAction={() => onSidebarCollapsedChange(true)} />
          <ResizeHandle side="right" currentWidth={sidebarWidth} onResize={onSidebarWidthChange} />
        </aside>
      )}

      <main className="min-w-0 min-h-0 overflow-y-auto" style={{ gridColumn: "2 / 3" }}>
        <Outlet />
      </main>

      {inspectorAvailable && (inspectorCollapsed ? (
        <CollapsedPanelRail side="right" label="Show inspector" onAction={() => onInspectorCollapsedChange(false)} />
      ) : (
        <aside className="relative border-l border-hair min-h-0 overflow-hidden" style={{ gridColumn: "3 / 4" }}>
          <ResizeHandle side="left" currentWidth={inspectorWidth} onResize={onInspectorWidthChange} />
          <CollapsePanelTab side="right" label="Hide inspector" onAction={() => onInspectorCollapsedChange(true)} />
          <InspectorPanel
            rulesTab={
              <Suspense fallback={null}>
                <RulesTab />
              </Suspense>
            }
          />
        </aside>
      ))}
    </div>
  );
}
