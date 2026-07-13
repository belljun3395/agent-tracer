/** 3열 셸의 열 너비를 영속화하고, `wide` 브레이크포인트 아래에서는 반응형 셸이 쓰는 일시적 drawer 상태도 담는다. */
export interface LayoutSlice {
  readonly sidebarWidth: number;
  readonly inspectorWidth: number;
  /** `wide` 뷰포트에서의 명시적 접힘 상태. */
  readonly sidebarCollapsed: boolean;
  readonly inspectorCollapsed: boolean;
  /** 사이드바의 모바일 drawer 상태. */
  readonly sidebarDrawerOpen: boolean;
  /** inspector의 narrow / mobile drawer 상태. */
  readonly inspectorDrawerOpen: boolean;
  /** 키보드 단축키 치트시트 오버레이. */
  readonly shortcutsOpen: boolean;
  readonly setSidebarWidth: (width: number) => void;
  readonly setInspectorWidth: (width: number) => void;
  readonly setSidebarCollapsed: (collapsed: boolean) => void;
  readonly setInspectorCollapsed: (collapsed: boolean) => void;
  readonly setSidebarDrawerOpen: (open: boolean) => void;
  readonly setInspectorDrawerOpen: (open: boolean) => void;
  readonly setShortcutsOpen: (open: boolean) => void;
}

/** 접힌 패널 레일의 픽셀 너비(펼치기 화살표만 있는 폭). */
export const COLLAPSED_RAIL_WIDTH = 28;

const DEFAULT_SIDEBAR_WIDTH = 280;
const DEFAULT_INSPECTOR_WIDTH = 380;

export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 480;
export const INSPECTOR_MIN = 300;
export const INSPECTOR_MAX = 600;

type SetState = (
  partial: Partial<LayoutSlice> | ((state: LayoutSlice) => Partial<LayoutSlice>),
) => void;

export function createLayoutSlice(set: SetState): LayoutSlice {
  return {
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    inspectorWidth: DEFAULT_INSPECTOR_WIDTH,
    sidebarCollapsed: false,
    inspectorCollapsed: false,
    sidebarDrawerOpen: false,
    inspectorDrawerOpen: false,
    shortcutsOpen: false,
    setSidebarWidth: (width) =>
      set({ sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) }),
    setInspectorWidth: (width) =>
      set({ inspectorWidth: clamp(width, INSPECTOR_MIN, INSPECTOR_MAX) }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    setInspectorCollapsed: (collapsed) => set({ inspectorCollapsed: collapsed }),
    setSidebarDrawerOpen: (open) => set({ sidebarDrawerOpen: open }),
    setInspectorDrawerOpen: (open) => set({ inspectorDrawerOpen: open }),
    setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
