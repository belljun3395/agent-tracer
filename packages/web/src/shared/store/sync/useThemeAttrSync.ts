import { useEffect } from "react";
import { useTheme } from "~web/shared/store/hooks.js";
import {
  useSystemColorScheme,
  type ColorScheme,
} from "~web/shared/store/sync/useSystemColorScheme.js";

/** 사용자 선호(`dark` | `light` | `system`)를 구체적인 color scheme으로 확정해 <html>의 `data-theme`로 적용한다. */
export function useThemeAttrSync(): void {
  const theme = useTheme();
  const system = useSystemColorScheme();
  const resolved: ColorScheme = theme === "system" ? system : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);
}
