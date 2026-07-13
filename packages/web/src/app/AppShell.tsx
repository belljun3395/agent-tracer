import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getMonitorWsUrl } from "~web/shared/api/realtime/monitor-ws-url.js";
import { useViewport } from "~web/shared/lib/hooks/use-viewport.js";
import { useMonitorSocket } from "~web/app/realtime/use-monitor-socket.js";
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
} from "~web/shared/store/index.js";
import { Toaster } from "~web/widgets/notifications/Toaster.js";
import { useSdkJobToasts } from "~web/widgets/notifications/useSdkJobToasts.js";
import { CompactAppLayout } from "~web/app/layout/CompactAppLayout.js";
import { ShortcutsOverlay } from "~web/app/layout/ShortcutsOverlay.js";
import { WideAppLayout } from "~web/app/layout/WideAppLayout.js";
import { useKeyboardShortcuts } from "~web/app/layout/useKeyboardShortcuts.js";

/** 앱 전역 동기화와 실시간 연결을 뷰포트별 레이아웃에 연결한다. */
export function AppShell() {
  useSyncSelectionFromRoute();
  useThemeAttrSync();
  useKeyboardShortcuts();

  const selectedTaskId = useSelectedTaskId();
  const viewport = useViewport();
  const [wsConnected, setWsConnected] = useState(false);
  const onSdkJobMessage = useSdkJobToasts();
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

  useMonitorSocket({
    url: getMonitorWsUrl(),
    selectedTaskId,
    onConnectionChange: setWsConnected,
    onMessage: onSdkJobMessage,
  });

  useEffect(() => {
    if (viewport !== "wide") return;
    if (sidebarDrawerOpen) setSidebarDrawerOpen(false);
    if (inspectorDrawerOpen) setInspectorDrawerOpen(false);
  }, [
    viewport,
    sidebarDrawerOpen,
    inspectorDrawerOpen,
    setSidebarDrawerOpen,
    setInspectorDrawerOpen,
  ]);

  const location = useLocation();
  useEffect(() => {
    if (viewport !== "wide" && sidebarDrawerOpen) setSidebarDrawerOpen(false);
  }, [location.pathname]);

  const layout = viewport === "wide" ? (
    <WideAppLayout
      wsConnected={wsConnected}
      inspectorAvailable={selectedTaskId !== null}
      sidebarWidth={sidebarWidth}
      inspectorWidth={inspectorWidth}
      sidebarCollapsed={sidebarCollapsed}
      inspectorCollapsed={inspectorCollapsed}
      onSidebarWidthChange={setSidebarWidth}
      onInspectorWidthChange={setInspectorWidth}
      onSidebarCollapsedChange={setSidebarCollapsed}
      onInspectorCollapsedChange={setInspectorCollapsed}
    />
  ) : (
    <CompactAppLayout
      viewport={viewport}
      wsConnected={wsConnected}
      inspectorAvailable={selectedTaskId !== null}
      sidebarWidth={sidebarWidth}
      inspectorWidth={inspectorWidth}
      sidebarDrawerOpen={sidebarDrawerOpen}
      inspectorDrawerOpen={inspectorDrawerOpen}
      onSidebarWidthChange={setSidebarWidth}
      onSidebarDrawerOpenChange={setSidebarDrawerOpen}
      onInspectorDrawerOpenChange={setInspectorDrawerOpen}
    />
  );

  return (
    <>
      <ShortcutsOverlay />
      <Toaster />
      {layout}
    </>
  );
}
