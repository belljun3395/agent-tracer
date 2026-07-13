import { useUiStore } from "~web/shared/store/UiStoreProvider.js";
import type {
  InspectorTab,
  MainView,
  VisibleLane,
} from "~web/shared/store/slices/viewSlice.js";
import type {
  SearchScope,
  SidebarFilter,
  SidebarView,
} from "~web/shared/store/slices/sidebarSlice.js";
import type { Theme } from "~web/shared/store/slices/themeSlice.js";
import type { GuidanceLocale } from "~web/shared/guidance.js";
import type { EventId, TaskId } from "~web/shared/identity.js";

// ── theme ─────────────────────────────────────────────────────────────
export const useTheme = (): Theme => useUiStore((s) => s.theme);
export const useSetTheme = () => useUiStore((s) => s.setTheme);

// ── 설명 언어 ────────────────────────────────────────────────────────
export const useGuidanceLocale = (): GuidanceLocale =>
  useUiStore((s) => s.guidanceLocale);
export const useSetGuidanceLocale = () =>
  useUiStore((s) => s.setGuidanceLocale);

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
export const useSidebarCollapsed = (): boolean =>
  useUiStore((s) => s.sidebarCollapsed);
export const useInspectorCollapsed = (): boolean =>
  useUiStore((s) => s.inspectorCollapsed);
export const useSetSidebarCollapsed = () =>
  useUiStore((s) => s.setSidebarCollapsed);
export const useSetInspectorCollapsed = () =>
  useUiStore((s) => s.setInspectorCollapsed);
export const useShortcutsOpen = (): boolean =>
  useUiStore((s) => s.shortcutsOpen);
export const useSetShortcutsOpen = () => useUiStore((s) => s.setShortcutsOpen);

/** atom 단위 selector. 각 훅은 primitive 하나(또는 action 하나)만 반환해, 소비자는 자신이 실제로 쓰는 값이 바뀔 때만 재렌더링된다. */

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
export const useSidebarView = (): SidebarView => useUiStore((s) => s.view);
export const useSetSidebarView = () => useUiStore((s) => s.setView);
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
export const useShowArchived = (): boolean => useUiStore((s) => s.showArchived);
export const useSetShowArchived = () => useUiStore((s) => s.setShowArchived);
