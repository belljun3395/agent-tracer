export type Theme = "dark" | "light" | "system";

export interface ThemeSlice {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
}

type SetState = (
  partial: Partial<ThemeSlice> | ((state: ThemeSlice) => Partial<ThemeSlice>),
) => void;

/**
 * Theme preference. Three values:
 *
 *   • "dark"   — force dark, ignore OS setting
 *   • "light"  — force light, ignore OS setting
 *   • "system" — follow `prefers-color-scheme` (default)
 *
 * The actual `data-theme` attribute on <html> is applied by
 * `useThemeAttrSync` — this slice just owns the user's preference.
 */
export function createThemeSlice(set: SetState): ThemeSlice {
  return {
    theme: "system",
    setTheme: (theme) => set({ theme }),
  };
}
