import { useUiStore } from "./UiStoreProvider.js";
import type {
  InspectorTab,
  MainView,
  VisibleLane,
} from "./slices/viewSlice.js";
import type { SearchScope, SidebarFilter } from "./slices/sidebarSlice.js";
import type { Theme } from "./slices/themeSlice.js";
import type { EventId, TaskId } from "~domain/monitoring.js";

// ── theme ─────────────────────────────────────────────────────────────
export const useTheme = (): Theme => useUiStore((s) => s.theme);
export const useSetTheme = () => useUiStore((s) => s.setTheme);

// ── layout ────────────────────────────────────────────────────────────
export const useSidebarWidth = (): number => useUiStore((s) => s.sidebarWidth);
export const useInspectorWidth = (): number =>
  useUiStore((s) => s.inspectorWidth);
export const useSetSidebarWidth = () => useUiStore((s) => s.setSidebarWidth);
export const useSetInspectorWidth = () =>
  useUiStore((s) => s.setInspectorWidth);
export const useSidebarDrawerOpen = (): boolean =>
  useUiStore((s) => s.sidebarDrawerOpen);
export const useInspectorDrawerOpen = (): boolean =>
  useUiStore((s) => s.inspectorDrawerOpen);
export const useSetSidebarDrawerOpen = () =>
  useUiStore((s) => s.setSidebarDrawerOpen);
export const useSetInspectorDrawerOpen = () =>
  useUiStore((s) => s.setInspectorDrawerOpen);

/*
 * Atom-level selectors. Each hook returns ONE primitive (or one action),
 * so consumers only re-render when the value they actually use changes.
 *
 * Action selectors (set*) are stable references — they don't trigger
 * re-renders even though they're returned each call.
 */

// ── selection ─────────────────────────────────────────────────────────
export const useSelectedTaskId = (): TaskId | null =>
  useUiStore((s) => s.selectedTaskId);

export const useSelectedEventId = (): EventId | null =>
  useUiStore((s) => s.selectedEventId);

export const useSetSelectedTaskId = () => useUiStore((s) => s.setSelectedTaskId);
export const useSetSelectedEventId = () => useUiStore((s) => s.setSelectedEventId);

// ── view ──────────────────────────────────────────────────────────────
export const useMainView = (): MainView => useUiStore((s) => s.mainView);
export const useSetMainView = () => useUiStore((s) => s.setMainView);

export const useInspectorTab = (): InspectorTab =>
  useUiStore((s) => s.inspectorTab);

export const useSetInspectorTab = () => useUiStore((s) => s.setInspectorTab);

export const useVisibleLanes = (): readonly VisibleLane[] =>
  useUiStore((s) => s.visibleLanes);
export const useToggleVisibleLane = () =>
  useUiStore((s) => s.toggleVisibleLane);
export const useSetVisibleLanes = () => useUiStore((s) => s.setVisibleLanes);

// ── sidebar ───────────────────────────────────────────────────────────
export const useSidebarFilter = (): SidebarFilter => useUiStore((s) => s.filter);
export const useSidebarSearchQuery = (): string =>
  useUiStore((s) => s.searchQuery);
export const useLastSeenAt = (): Readonly<Record<string, number>> =>
  useUiStore((s) => s.lastSeenAt);
export const useCollapsedParents = (): readonly string[] =>
  useUiStore((s) => s.collapsedParents);
export const useToggleCollapsedParent = () =>
  useUiStore((s) => s.toggleCollapsedParent);

export const useSidebarSearchScope = (): SearchScope =>
  useUiStore((s) => s.searchScope);

export const useSetSidebarFilter = () => useUiStore((s) => s.setFilter);
export const useSetSidebarSearchQuery = () =>
  useUiStore((s) => s.setSearchQuery);
export const useSetSidebarSearchScope = () =>
  useUiStore((s) => s.setSearchScope);
export const useMarkTaskRead = () => useUiStore((s) => s.markTaskRead);
