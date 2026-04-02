/**
 * 사이드바 및 인스펙터 패널 리사이즈 드래그 로직.
 * pointer 이벤트로 너비를 조절하고 localStorage에 persist한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_DEFAULT_WIDTH = 200;
const SIDEBAR_WIDTH_STORAGE_KEY = "agent-tracer.sidebar-width";

const INSPECTOR_MIN_WIDTH = 280;
const INSPECTOR_MAX_WIDTH = 560;
const INSPECTOR_DEFAULT_WIDTH = 300;
const INSPECTOR_WIDTH_STORAGE_KEY = "agent-tracer.inspector-width";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseResizableReturn {
  readonly sidebarWidth: number;
  readonly inspectorWidth: number;
  readonly isSidebarCollapsed: boolean;
  readonly isInspectorCollapsed: boolean;
  readonly viewportWidth: number;
  readonly setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsInspectorCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly onSidebarResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  readonly onInspectorResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useResizable(): UseResizableReturn {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handleResize = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed));
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const raw = window.localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
    if (!raw) return INSPECTOR_DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return INSPECTOR_DEFAULT_WIDTH;
    return Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, parsed));
  });

  // Auto-collapse inspector on narrow viewports (initial render only).
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(() => window.innerWidth < 1280);

  const sidebarResizeRef = useRef<{ readonly startX: number; readonly startWidth: number } | null>(null);
  const inspectorResizeRef = useRef<{ readonly startX: number; readonly startWidth: number } | null>(null);

  // Persist widths
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorWidth));
  }, [inspectorWidth]);

  const onSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || isSidebarCollapsed) return;
    sidebarResizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };

    const onMove = (moveEvent: PointerEvent): void => {
      const current = sidebarResizeRef.current;
      if (!current) return;
      const delta = moveEvent.clientX - current.startX;
      const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(current.startWidth + delta)));
      setSidebarWidth(clamped);
    };

    const onUp = (): void => {
      sidebarResizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("is-resizing-sidebar");
    };

    document.body.classList.add("is-resizing-sidebar");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    event.preventDefault();
  }, [isSidebarCollapsed, sidebarWidth]);

  const onInspectorResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || isInspectorCollapsed) return;
    inspectorResizeRef.current = { startX: event.clientX, startWidth: inspectorWidth };

    const onMove = (moveEvent: PointerEvent): void => {
      const current = inspectorResizeRef.current;
      if (!current) return;
      // Inspector는 오른쪽에 있으므로 왼쪽으로 드래그할수록 너비 증가
      const delta = current.startX - moveEvent.clientX;
      const clamped = Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, Math.round(current.startWidth + delta)));
      setInspectorWidth(clamped);
    };

    const onUp = (): void => {
      inspectorResizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("is-resizing-inspector");
    };

    document.body.classList.add("is-resizing-inspector");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    event.preventDefault();
  }, [isInspectorCollapsed, inspectorWidth]);

  return {
    sidebarWidth,
    inspectorWidth,
    isSidebarCollapsed,
    isInspectorCollapsed,
    viewportWidth,
    setIsSidebarCollapsed,
    setIsInspectorCollapsed,
    onSidebarResizeStart,
    onInspectorResizeStart
  };
}
