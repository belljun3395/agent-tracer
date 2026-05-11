import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  useInspectorCollapsed,
  useInspectorDrawerOpen,
  useInspectorWidth,
  useSelectedTaskId,
  useSetInspectorCollapsed,
  useSetInspectorDrawerOpen,
  useSetInspectorWidth,
  useSetSidebarCollapsed,
  useSetSidebarDrawerOpen,
  useSetSidebarWidth,
  useSidebarCollapsed,
  useSidebarDrawerOpen,
  useSidebarWidth,
  useSyncSelectionFromRoute,
  useThemeAttrSync,
} from "~state/ui/index.js";
import { COLLAPSED_RAIL_WIDTH } from "~state/ui/slices/layoutSlice.js";
import { useMonitorSocket } from "~state/realtime/useMonitorSocket.js";
import { getMonitorWsUrl } from "~io/api.js";
import { useViewport } from "~lib/use-viewport.js";
import { useKeyboardShortcuts } from "~lib/use-keyboard-shortcuts.js";
import { TopBar } from "~features/topbar/index.js";
import { TaskListPanel } from "~features/task-list/index.js";
import { InspectorPanel } from "~features/inspector/index.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { ShortcutsOverlay } from "./ShortcutsOverlay.js";

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
  // / · j · k · g · Esc, registered once at the shell.
  useKeyboardShortcuts();

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

  const sidebarCollapsed = useSidebarCollapsed();
  const inspectorCollapsed = useInspectorCollapsed();
  const setSidebarCollapsed = useSetSidebarCollapsed();
  const setInspectorCollapsed = useSetInspectorCollapsed();

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
    // We deliberately depend on `pathname` only — including the drawer
    // setter / state in deps would re-trigger the close on its own
    // open transition.
  }, [location.pathname]);

  const inspectorAvailable = viewport === "wide" && selectedTaskId !== null;
  const sidebarColumnWidth = sidebarCollapsed
    ? COLLAPSED_RAIL_WIDTH
    : sidebarWidth;
  const inspectorColumnWidth = inspectorCollapsed
    ? COLLAPSED_RAIL_WIDTH
    : inspectorWidth;

  if (viewport === "wide") {
    return (
      <>
      <ShortcutsOverlay />
      <div
        className="grid h-screen min-h-0 overflow-hidden"
        style={{
          gridTemplateColumns: inspectorAvailable
            ? `${sidebarColumnWidth}px 1fr ${inspectorColumnWidth}px`
            : `${sidebarColumnWidth}px 1fr`,
          gridTemplateRows: "48px 1fr",
          background: "var(--canvas)",
          color: "var(--ink)",
        }}
      >
        <header
          className="border-b border-[var(--hair)]"
          style={{ gridColumn: inspectorAvailable ? "1 / 4" : "1 / 3" }}
        >
          <TopBar wsConnected={wsConnected} viewport={viewport} />
        </header>

        {sidebarCollapsed ? (
          <CollapsedRail
            side="left"
            label="Show task list"
            onExpand={() => setSidebarCollapsed(false)}
          />
        ) : (
          <aside
            className="relative border-r border-[var(--hair)] min-h-0 overflow-hidden"
            style={{ gridColumn: "1 / 2" }}
          >
            <TaskListPanel />
            <CollapseTab
              side="left"
              label="Hide task list"
              onCollapse={() => setSidebarCollapsed(true)}
            />
            <ResizeHandle
              side="right"
              currentWidth={sidebarWidth}
              onResize={setSidebarWidth}
            />
          </aside>
        )}

        <main
          className="min-w-0 min-h-0 overflow-y-auto"
          style={{ gridColumn: "2 / 3" }}
        >
          <Outlet />
        </main>

        {inspectorAvailable &&
          (inspectorCollapsed ? (
            <CollapsedRail
              side="right"
              label="Show inspector"
              onExpand={() => setInspectorCollapsed(false)}
            />
          ) : (
            <aside
              className="relative border-l border-[var(--hair)] min-h-0 overflow-hidden"
              style={{ gridColumn: "3 / 4" }}
            >
              <ResizeHandle
                side="left"
                currentWidth={inspectorWidth}
                onResize={setInspectorWidth}
              />
              <CollapseTab
                side="right"
                label="Hide inspector"
                onCollapse={() => setInspectorCollapsed(true)}
              />
              <InspectorPanel />
            </aside>
          ))}
      </div>
      </>
    );
  }

  // Narrow / mobile: stack with optional slide-over drawers.
  const canOpenInspectorDrawer = selectedTaskId !== null;
  const inspectorDrawerWidth = Math.min(
    inspectorWidth,
    viewport === "mobile" ? 380 : 460,
  );

  return (
    <>
    <ShortcutsOverlay />
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
    </>
  );
}

/**
 * Thin rail rendered in place of a collapsed wide-viewport panel. Just
 * the border, a vertical label, and a centered expand chevron so the
 * panel is one click away without eating layout width.
 */
function CollapsedRail({
  side,
  label,
  onExpand,
}: {
  readonly side: "left" | "right";
  readonly label: string;
  readonly onExpand: () => void;
}) {
  return (
    <aside
      className={
        side === "left"
          ? "relative border-r border-[var(--hair)] min-h-0 overflow-hidden"
          : "relative border-l border-[var(--hair)] min-h-0 overflow-hidden"
      }
      style={{
        gridColumn: side === "left" ? "1 / 2" : "3 / 4",
        background: "var(--canvas)",
      }}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={label}
        title={label}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          color: "var(--ink-tertiary)",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {side === "left" ? <ChevronRight /> : <ChevronLeft />}
      </button>
    </aside>
  );
}

/**
 * Small chevron tab pinned to the panel's inner border. Clicking
 * collapses the panel down to the `CollapsedRail`. Position is chosen
 * so it stays clear of the ResizeHandle hit area.
 */
function CollapseTab({
  side,
  label,
  onCollapse,
}: {
  readonly side: "left" | "right";
  readonly label: string;
  readonly onCollapse: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCollapse}
      aria-label={label}
      title={label}
      className="absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-7 w-5 rounded-[var(--radius-xs)]"
      style={{
        // Offset slightly inside the panel away from the ResizeHandle,
        // which lives on the same edge.
        left: side === "left" ? "auto" : 4,
        right: side === "left" ? 4 : "auto",
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        color: "var(--ink-tertiary)",
        cursor: "pointer",
        zIndex: 12,
      }}
    >
      {side === "left" ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
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
