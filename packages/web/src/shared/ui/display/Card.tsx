import type { ReactNode } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

interface CardProps {
  readonly title?: string;
  readonly count?: number;
  readonly surface?: "canvas" | "s1";
  readonly className?: string;
  readonly children: ReactNode;
}

export function Card({ title, count, surface = "s1", className, children }: CardProps) {
  return (
    <section
      className={cn(
        "border border-hair rounded-md p-3.5 flex flex-col gap-2.5",
        surface === "canvas" ? "bg-canvas" : "bg-s1",
        className,
      )}
    >
      {title && (
        <header className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-tertiary">
            {title}
          </span>
          {count !== undefined && (
            <span className="text-[11px] text-ink-muted">{count}</span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
