import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { InspectorPanel } from "~web/widgets/inspector/index.js";
import { TaskListPanel } from "~web/widgets/task-list/index.js";
import { TopBar } from "~web/widgets/topbar/index.js";
import type { ViewportTier } from "~web/shared/lib/hooks/use-viewport.js";
import { Drawer } from "~web/app/layout/Drawer.js";
import { ResizeHandle } from "~web/app/layout/ResizeHandle.js";

// Inspector의 Rules 탭은 다른 위젯 슬라이스라 조립부인 여기서 주입한다.
const RulesTab = lazy(() =>
  import("~web/widgets/rules/index.js").then((m) => ({ default: m.RulesTab })),
);

interface CompactAppLayoutProps {
  readonly viewport: Exclude<ViewportTier, "wide">;
  readonly wsConnected: boolean;
  readonly inspectorAvailable: boolean;
  readonly sidebarWidth: number;
  readonly inspectorWidth: number;
  readonly sidebarDrawerOpen: boolean;
  readonly inspectorDrawerOpen: boolean;
  readonly onSidebarWidthChange: (width: number) => void;
  readonly onSidebarDrawerOpenChange: (open: boolean) => void;
  readonly onInspectorDrawerOpenChange: (open: boolean) => void;
}

/** 좁은 뷰포트의 고정 사이드바와 모바일 보조 시트를 조합한다. */
export function CompactAppLayout({
  viewport,
  wsConnected,
  inspectorAvailable,
  sidebarWidth,
  inspectorWidth,
  sidebarDrawerOpen,
  inspectorDrawerOpen,
  onSidebarWidthChange,
  onSidebarDrawerOpenChange,
  onInspectorDrawerOpenChange,
}: CompactAppLayoutProps) {
  const inspectorDrawerWidth = Math.min(inspectorWidth, viewport === "mobile" ? 380 : 460);

  return (
    <div
      className="grid h-screen min-h-0 overflow-hidden bg-canvas text-ink"
      style={{
        gridTemplateColumns: viewport === "narrow"
          ? `${sidebarWidth}px minmax(0, 1fr)`
          : "minmax(0, 1fr)",
        gridTemplateRows: "48px 1fr",
      }}
    >
      <header className="border-b border-hair" style={{ gridColumn: "1 / -1" }}>
        <TopBar wsConnected={wsConnected} viewport={viewport} />
      </header>

      {viewport === "narrow" ? (
        <aside className="relative border-r border-hair min-h-0 overflow-hidden" style={{ gridColumn: "1 / 2" }}>
          <TaskListPanel />
          <ResizeHandle side="right" currentWidth={sidebarWidth} onResize={onSidebarWidthChange} />
        </aside>
      ) : null}

      <main className="min-w-0 min-h-0 overflow-y-auto" style={{ gridColumn: viewport === "narrow" ? "2 / 3" : "1 / -1" }}>
        <Outlet />
      </main>

      {viewport === "mobile" && sidebarDrawerOpen ? (
        <Drawer
          side="left"
          width={Math.min(sidebarWidth + 40, 340)}
          onDismiss={() => onSidebarDrawerOpenChange(false)}
          label="Task list"
        >
          <TaskListPanel />
        </Drawer>
      ) : null}

      {inspectorAvailable && inspectorDrawerOpen ? (
        <Drawer
          side="right"
          width={inspectorDrawerWidth}
          onDismiss={() => onInspectorDrawerOpenChange(false)}
          label="Inspector"
        >
          <InspectorPanel
            rulesTab={
              <Suspense fallback={null}>
                <RulesTab />
              </Suspense>
            }
          />
        </Drawer>
      ) : null}
    </div>
  );
}
