import { createStore, type StoreApi } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  createSelectionSlice,
  type SelectionSlice,
} from "~web/shared/store/slices/selectionSlice.js";
import {
  createViewSlice,
  type MainView,
  type ViewSlice,
} from "~web/shared/store/slices/viewSlice.js";
import {
  createSidebarSlice,
  type SidebarSlice,
} from "~web/shared/store/slices/sidebarSlice.js";
import {
  createLayoutSlice,
  type LayoutSlice,
} from "~web/shared/store/slices/layoutSlice.js";
import {
  createThemeSlice,
  type ThemeSlice,
} from "~web/shared/store/slices/themeSlice.js";
import {
  createGuidanceLocaleSlice,
  type GuidanceLocaleSlice,
} from "~web/shared/store/slices/guidanceLocaleSlice.js";
import { normalizeGuidanceLocale } from "~web/shared/guidance.js";

export type UiStore = SelectionSlice &
  ViewSlice &
  SidebarSlice &
  LayoutSlice &
  ThemeSlice &
  GuidanceLocaleSlice;
export type UiStoreApi = StoreApi<UiStore>;

const STORAGE_KEY = "agent-tracer:ui:v1";

interface CreateUiStoreOptions {
  /** localStorage 영속화를 건너뛴다. */
  readonly persisted?: boolean;
}

export function createUiStore(options?: CreateUiStoreOptions): UiStoreApi {
  const persisted = options?.persisted ?? true;

  if (!persisted) {
    return createStore<UiStore>()((set) => ({
      ...createSelectionSlice(set),
      ...createViewSlice(set),
      ...createSidebarSlice(set),
      ...createLayoutSlice(set),
      ...createThemeSlice(set),
      ...createGuidanceLocaleSlice(set),
    }));
  }

  return createStore<UiStore>()(
    persist(
      (set) => ({
        ...createSelectionSlice(set),
        ...createViewSlice(set),
        ...createSidebarSlice(set),
        ...createLayoutSlice(set),
        ...createThemeSlice(set),
        ...createGuidanceLocaleSlice(set),
      }),
      {
        name: STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        /** 새로고침 후에도 유지되어야 할 값만 영속화한다. */
        partialize: (state) => ({
          view: state.view,
          filter: state.filter,
          searchScope: state.searchScope,
          searchType: state.searchType,
          lastSeenAt: state.lastSeenAt,
          collapsedParents: state.collapsedParents,
          showArchived: state.showArchived,
          mainView: state.mainView,
          inspectorTab: state.inspectorTab,
          visibleLanes: state.visibleLanes,
          sidebarWidth: state.sidebarWidth,
          inspectorWidth: state.inspectorWidth,
          sidebarCollapsed: state.sidebarCollapsed,
          inspectorCollapsed: state.inspectorCollapsed,
          theme: state.theme,
          guidanceLocale: state.guidanceLocale,
        }),
        merge: mergePersistedUiState,
      },
    ),
  );
}

function mergePersistedUiState(
  persistedState: unknown,
  currentState: UiStore,
): UiStore {
  const persisted = isUiStatePatch(persistedState) ? persistedState : {};
  const merged = { ...currentState, ...persisted };
  return {
    ...merged,
    mainView: isMainView(merged.mainView) ? merged.mainView : "feed",
    guidanceLocale: normalizeGuidanceLocale(merged.guidanceLocale),
  };
}

function isUiStatePatch(value: unknown): value is Partial<UiStore> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMainView(value: unknown): value is MainView {
  return value === "feed" || value === "graph";
}
