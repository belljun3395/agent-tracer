import { useEffect, useState } from "react";

export type ColorScheme = "dark" | "light";

const QUERY = "(prefers-color-scheme: dark)";

/** `(prefers-color-scheme: dark)` 미디어 쿼리로 OS 레벨 색상 선호를 실시간으로 반영해 반환한다. */
export function useSystemColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() =>
    window.matchMedia(QUERY).matches ? "dark" : "light",
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = (event: MediaQueryListEvent | MediaQueryList) => {
      setScheme(event.matches ? "dark" : "light");
    };
    apply(mq); // 초기 렌더링을 현재 쿼리 상태와 맞춘다
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
    };
  }, []);

  return scheme;
}
