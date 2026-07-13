export type Theme = "dark" | "light" | "system";

export interface ThemeSlice {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
}

type SetState = (
  partial: Partial<ThemeSlice> | ((state: ThemeSlice) => Partial<ThemeSlice>),
) => void;

/** 테마 선호. */
export function createThemeSlice(set: SetState): ThemeSlice {
  return {
    theme: "system",
    setTheme: (theme) => set({ theme }),
  };
}
