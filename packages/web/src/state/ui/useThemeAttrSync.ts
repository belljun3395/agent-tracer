import { useEffect } from "react";
import { useTheme } from "./hooks.js";
import {
  useSystemColorScheme,
  type ColorScheme,
} from "./useSystemColorScheme.js";

/**
 * Resolve the user's preference (`dark` | `light` | `system`) into a
 * concrete color scheme, then apply it as `data-theme` on <html>.
 *
 * Called once from AppShell — mounting it inside the store provider so
 * `useTheme` is available, and outside any route component so it doesn't
 * unmount during navigation. The CSS tokens layer reads the attribute
 * via `[data-theme="…"]` selectors.
 */
export function useThemeAttrSync(): void {
  const theme = useTheme();
  const system = useSystemColorScheme();
  const resolved: ColorScheme = theme === "system" ? system : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);
}
