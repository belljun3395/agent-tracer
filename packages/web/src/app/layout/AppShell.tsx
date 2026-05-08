import { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  useInspectorWidth,
  useSelectedTaskId,
  useSetInspectorWidth,
  useSetSidebarWidth,
  useSidebarWidth,
  useSyncSelectionFromRoute,
  useThemeAttrSync,
} from "~state/ui/index.js";
import { useMonitorSocket } from "~state/realtime/useMonitorSocket.js";
import { getMonitorWsUrl } from "~io/api.js";
import { TopBar } from "~features/topbar/index.js";
import { TaskListPanel } from "~features/task-list/index.js";
import { InspectorPanel } from "~features/inspector/index.js";
import { ResizeHandle } from "./ResizeHandle.js";

/**
 * v6 Operator app shell — 3-column grid with a fixed-height topbar and
 * draggable column dividers between sidebar / main / inspector.
 *
 *   ┌──────────── 48px topbar (cols 1..3) ────────────┐
 *   │ Wₛ    │     1fr (main · <Outlet/>)     │  Wᵢ   │
 *   │ side  │                                │ insp  │
 *   └───────┴────────────────────────────────┴───────┘
 *
 *   Wₛ, Wᵢ are persisted in the UI store and clamped per the layout slice
 *   so reloads restore the user's preferred widths.
 *
 * Sidebar and Inspector subscribe directly to the UI store, so navigating
 * between routes only swaps the main pane — WS state and selection state
 * stay mounted.
 */
export function AppShell() {
  // URL is the source of truth for selectedTaskId — keep store in sync.
  useSyncSelectionFromRoute();
  // Apply <html data-theme="…"> from store + OS preference.
  useThemeAttrSync();

  const selectedTaskId = useSelectedTaskId();
  const [wsConnected, setWsConnected] = useState(false);

  useMonitorSocket({
    url: getMonitorWsUrl(),
    selectedTaskId,
    onConnectionChange: setWsConnected,
  });

  const sidebarWidth = useSidebarWidth();
  const inspectorWidth = useInspectorWidth();
  const setSidebarWidth = useSetSidebarWidth();
  const setInspectorWidth = useSetInspectorWidth();

  return (
    <div
      className="grid h-screen min-h-0 overflow-hidden"
      style={{
        gridTemplateColumns: `${sidebarWidth}px 1fr ${inspectorWidth}px`,
        gridTemplateRows: "48px 1fr",
        background: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <header
        className="border-b border-[var(--hair)]"
        style={{ gridColumn: "1 / 4" }}
      >
        <TopBar wsConnected={wsConnected} />
      </header>

      <aside
        className="relative border-r border-[var(--hair)] min-h-0 overflow-hidden"
        style={{ gridColumn: "1 / 2" }}
      >
        <TaskListPanel />
        <ResizeHandle
          side="right"
          currentWidth={sidebarWidth}
          onResize={setSidebarWidth}
        />
      </aside>

      <main
        className="min-w-0 min-h-0 overflow-y-auto"
        style={{ gridColumn: "2 / 3" }}
      >
        <Outlet />
      </main>

      <aside
        className="relative border-l border-[var(--hair)] min-h-0 overflow-hidden"
        style={{ gridColumn: "3 / 4" }}
      >
        <ResizeHandle
          side="left"
          currentWidth={inspectorWidth}
          onResize={setInspectorWidth}
        />
        <InspectorPanel />
      </aside>
    </div>
  );
}
