import type { ReactNode } from "react";
import { TooltipProvider } from "~ui/index.js";

interface ThemeProviderProps {
  readonly children: ReactNode;
}

/**
 * Outer provider wrapping the route tree with TooltipProvider only.
 *
 * Theme attribute application moved into `useThemeAttrSync` (called from
 * AppShell) — that hook sits inside the UiStoreProvider where the user's
 * preference lives, which this provider can't reach because it's outside
 * the store.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return <TooltipProvider delayDuration={250}>{children}</TooltipProvider>;
}
