/**
 * Persisted column widths for the 3-column shell plus transient drawer
 * state used by the responsive shell below the `wide` breakpoint.
 *
 * Defaults match v6 mock (280 / 1fr / 380). Min/max are clamped here so
 * UI consumers don't need to repeat the bounds — drag handlers always
 * land in a sane range, even if a future migration introduces drifted
 * persisted values.
 */
export interface LayoutSlice {
  readonly sidebarWidth: number;
  readonly inspectorWidth: number;
  /**
   * Mobile drawer state for the sidebar. Closed by default so a fresh
   * mobile load doesn't bury the main pane behind the task list.
   */
  readonly sidebarDrawerOpen: boolean;
  /**
   * Narrow / mobile drawer state for the inspector. Closed by default
   * — the user explicitly opts in by tapping the topbar toggle.
   */
  readonly inspectorDrawerOpen: boolean;
  readonly setSidebarWidth: (width: number) => void;
  readonly setInspectorWidth: (width: number) => void;
  readonly setSidebarDrawerOpen: (open: boolean) => void;
  readonly setInspectorDrawerOpen: (open: boolean) => void;
}

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
    sidebarDrawerOpen: false,
    inspectorDrawerOpen: false,
    setSidebarWidth: (width) =>
      set({ sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) }),
    setInspectorWidth: (width) =>
      set({ inspectorWidth: clamp(width, INSPECTOR_MIN, INSPECTOR_MAX) }),
    setSidebarDrawerOpen: (open) => set({ sidebarDrawerOpen: open }),
    setInspectorDrawerOpen: (open) => set({ inspectorDrawerOpen: open }),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
