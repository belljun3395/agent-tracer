import type { ReactNode } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

export function SectionLabel({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return (
    <div className={cn("font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-tertiary font-semibold", className)}>
      {children}
    </div>
  );
}
