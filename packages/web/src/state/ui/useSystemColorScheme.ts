import { useEffect, useState } from "react";

export type ColorScheme = "dark" | "light";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * Returns the current OS-level color preference, kept live via the
 * `(prefers-color-scheme: dark)` media query.
 *
 * Browser-only — this app doesn't SSR. If we ever do, gate the
 * matchMedia calls behind a `typeof window` check.
 */
export function useSystemColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() =>
    window.matchMedia(QUERY).matches ? "dark" : "light",
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = (event: MediaQueryListEvent | MediaQueryList) => {
      setScheme(event.matches ? "dark" : "light");
    };
    apply(mq); // sync the initial render with the live query
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
    };
  }, []);

  return scheme;
}
