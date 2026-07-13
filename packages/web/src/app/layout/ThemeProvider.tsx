import type { ReactNode } from "react";
import { TooltipProvider } from "~web/shared/ui/index.js";

interface ThemeProviderProps {
  readonly children: ReactNode;
}

/** 라우트 트리를 TooltipProvider로만 감싸는 바깥쪽 provider. 테마 속성 적용은 `useThemeAttrSync`(AppShell에서 호출)로 옮겨졌다. */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return <TooltipProvider delayDuration={250}>{children}</TooltipProvider>;
}
