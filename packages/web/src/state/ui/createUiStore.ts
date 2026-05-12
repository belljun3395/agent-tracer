import { createStore, type StoreApi } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  createSelectionSlice,
  type SelectionSlice,
} from "./slices/selectionSlice.js";
import { createViewSlice, type ViewSlice } from "./slices/viewSlice.js";
import {
  createSidebarSlice,
  type SidebarSlice,
} from "./slices/sidebarSlice.js";
import {
  createLayoutSlice,
  type LayoutSlice,
} from "./slices/layoutSlice.js";
import {
  createThemeSlice,
  type ThemeSlice,
} from "./slices/themeSlice.js";

export type UiStore = SelectionSlice &
  ViewSlice &
  SidebarSlice &
  LayoutSlice &
  ThemeSlice;
export type UiStoreApi = StoreApi<UiStore>;

const STORAGE_KEY = "agent-tracer:ui:v1";

interface CreateUiStoreOptions {
  /**
   * Skip localStorage persistence — used by tests so each run starts clean.
   */
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
      }),
      {
        name: STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        /**
         * Persist what should survive reload. Transient fields (selection)
         * are recomputed from URL or server state on next visit.
         */
        partialize: (state) => ({
          view: state.view,
          filter: state.filter,
          searchScope: state.searchScope,
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
        }),
      },
    ),
  );
}
