import type { ComponentPropsWithoutRef } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        "px-2.5 py-1.5 text-sm rounded-xs border border-hair bg-canvas text-ink",
        "outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
