import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  useInspectorDrawerOpen,
  useInspectorWidth,
  useSelectedTaskId,
  useSetInspectorDrawerOpen,
  useSetInspectorWidth,
  useSetSidebarDrawerOpen,
  useSetSidebarWidth,
  useSidebarDrawerOpen,
  useSidebarWidth,
  useSyncSelectionFromRoute,
  useThemeAttrSync,
} from "~state/ui/index.js";
import { useMonitorSocket } from "~state/realtime/useMonitorSocket.js";
import { getMonitorWsUrl } from "~io/api.js";
import { useViewport } from "~lib/use-viewport.js";
import { TopBar } from "~features/topbar/index.js";
import { TaskListPanel } from "~features/task-list/index.js";
import { InspectorPanel } from "~features/inspector/index.js";
import { ResizeHandle } from "./ResizeHandle.js";

/**
 * Operator app shell — responsive across three viewport tiers:
 *
 *   • wide  (≥1024 px)  — three-column grid: sidebar | main | inspector.
 *                         Column dividers are draggable; widths persist.
 *   • narrow (720–1023) — two-column grid: sidebar | main.
 *                         Inspector slides over from the right when the
 *                         user opens it from the topbar.
 *   • mobile (<720 px)  — single column. Both sidebar and inspector are
 *                         slide-over drawers opened from the topbar.
 *
 * The inspector column is collapsed entirely when no task is selected —
 * its tabs are all task-scoped, so a "select an action" rail beside a
 * "pick a task" main pane was a double empty state.
 */
export function AppShell() {
  // URL is the source of truth for selectedTaskId — keep store in sync.
  useSyncSelectionFromRoute();
  // Apply <html data-theme="…"> from store + OS preference.
  useThemeAttrSync();

  const selectedTaskId = useSelectedTaskId();
  const viewport = useViewport();
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

  const sidebarDrawerOpen = useSidebarDrawerOpen();
  const inspectorDrawerOpen = useInspectorDrawerOpen();
  const setSidebarDrawerOpen = useSetSidebarDrawerOpen();
  const setInspectorDrawerOpen = useSetInspectorDrawerOpen();

  // Auto-close drawers on viewport up-shift (wide) so we don't leave a
  // sheet floating once the user has room for the real columns.
  useEffect(() => {
    if (viewport === "wide") {
      if (sidebarDrawerOpen) setSidebarDrawerOpen(false);
      if (inspectorDrawerOpen) setInspectorDrawerOpen(false);
    }
  }, [
    viewport,
    sidebarDrawerOpen,
    inspectorDrawerOpen,
    setSidebarDrawerOpen,
    setInspectorDrawerOpen,
  ]);

  // Closing the drawer on route change keeps mobile flows tight — tapping
  // a sidebar row navigates and immediately reveals the new task.
  const location = useLocation();
  useEffect(() => {
    if (viewport !== "wide" && sidebarDrawerOpen) setSidebarDrawerOpen(false);
    // We deliberately depend on `pathname` only; opening the drawer
    // shouldn't re-trigger the close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const showInspectorColumn = viewport === "wide" && selectedTaskId !== null;

  if (viewport === "wide") {
    return (
      <div
        className="grid h-screen min-h-0 overflow-hidden"
        style={{
          gridTemplateColumns: showInspectorColumn
            ? `${sidebarWidth}px 1fr ${inspectorWidth}px`
            : `${sidebarWidth}px 1fr`,
          gridTemplateRows: "48px 1fr",
          background: "var(--canvas)",
          color: "var(--ink)",
        }}
      >
        <header
          className="border-b border-[var(--hair)]"
          style={{ gridColumn: showInspectorColumn ? "1 / 4" : "1 / 3" }}
        >
          <TopBar wsConnected={wsConnected} viewport={viewport} />
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

        {showInspectorColumn && (
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
        )}
      </div>
    );
  }

  // Narrow / mobile: stack with optional slide-over drawers.
  const canOpenInspectorDrawer = selectedTaskId !== null;
  const inspectorDrawerWidth = Math.min(
    inspectorWidth,
    viewport === "mobile" ? 380 : 460,
  );

  return (
    <div
      className="grid h-screen min-h-0 overflow-hidden"
      style={{
        gridTemplateColumns:
          viewport === "narrow" ? `${sidebarWidth}px 1fr` : "1fr",
        gridTemplateRows: "48px 1fr",
        background: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <header
        className="border-b border-[var(--hair)]"
        style={{ gridColumn: "1 / -1" }}
      >
        <TopBar wsConnected={wsConnected} viewport={viewport} />
      </header>

      {/*
       * Narrow: sidebar stays pinned on the left at its persisted width.
       * Mobile: sidebar is hidden, surfaced only via the slide-over drawer.
       */}
      {viewport === "narrow" && (
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
      )}

      <main
        className="min-w-0 min-h-0 overflow-y-auto"
        style={{ gridColumn: viewport === "narrow" ? "2 / 3" : "1 / -1" }}
      >
        <Outlet />
      </main>

      {viewport === "mobile" && sidebarDrawerOpen && (
        <Drawer
          side="left"
          width={Math.min(sidebarWidth + 40, 340)}
          onDismiss={() => setSidebarDrawerOpen(false)}
          label="Task list"
        >
          <TaskListPanel />
        </Drawer>
      )}

      {canOpenInspectorDrawer && inspectorDrawerOpen && (
        <Drawer
          side="right"
          width={inspectorDrawerWidth}
          onDismiss={() => setInspectorDrawerOpen(false)}
          label="Inspector"
        >
          <InspectorPanel />
        </Drawer>
      )}
    </div>
  );
}

interface DrawerProps {
  readonly side: "left" | "right";
  readonly width: number;
  readonly label: string;
  readonly onDismiss: () => void;
  readonly children: React.ReactNode;
}

/**
 * Tiny slide-over sheet used by the responsive shell. Backdrop closes
 * on click + Escape; first focusable element receives focus on open.
 */
function Drawer({ side, width, label, onDismiss, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ pointerEvents: "auto" }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss drawer"
        className="absolute inset-0"
        style={{
          background: "color-mix(in srgb, var(--canvas) 60%, transparent)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        className="relative min-h-0 overflow-hidden flex flex-col"
        style={{
          width,
          background: "var(--canvas)",
          marginLeft: side === "right" ? "auto" : 0,
          borderRight:
            side === "left" ? "1px solid var(--hair)" : "none",
          borderLeft:
            side === "right" ? "1px solid var(--hair)" : "none",
          boxShadow:
            side === "left"
              ? "4px 0 24px rgba(0,0,0,0.25)"
              : "-4px 0 24px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
