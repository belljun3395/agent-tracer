export { UiStoreProvider, useUiStore } from "~web/shared/store/UiStoreProvider.js";
export { createUiStore, type UiStore, type UiStoreApi } from "~web/shared/store/createUiStore.js";

export type { SelectionSlice } from "~web/shared/store/slices/selectionSlice.js";
export type { ViewSlice, InspectorTab, MainView } from "~web/shared/store/slices/viewSlice.js";
export type {
  SidebarSlice,
  SidebarFilter,
  SidebarView,
} from "~web/shared/store/slices/sidebarSlice.js";
export { SIDEBAR_FILTERS } from "~web/shared/store/slices/sidebarSlice.js";
export type { LayoutSlice } from "~web/shared/store/slices/layoutSlice.js";
export type { ThemeSlice, Theme } from "~web/shared/store/slices/themeSlice.js";
export type { GuidanceLocaleSlice } from "~web/shared/store/slices/guidanceLocaleSlice.js";

export * from "~web/shared/store/hooks.js";
export { useGuidance } from "~web/shared/store/useGuidance.js";
export { useSyncSelectionFromRoute } from "~web/shared/store/sync/useRouteSync.js";
export { useThemeAttrSync } from "~web/shared/store/sync/useThemeAttrSync.js";
export {
  useSystemColorScheme,
  type ColorScheme,
} from "~web/shared/store/sync/useSystemColorScheme.js";
