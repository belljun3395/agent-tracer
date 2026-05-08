import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

type PillTone = "neutral" | "ok" | "warn" | "err" | "primary";

interface PillProps extends ComponentPropsWithoutRef<"span"> {
  readonly tone?: PillTone;
  /** Show a small leading status dot of the matching tone. */
  readonly dot?: boolean;
  /** Pulse the leading dot (only when `dot` is true). */
  readonly pulse?: boolean;
}

const toneText: Record<PillTone, string> = {
  neutral: "text-[var(--ink-subtle)]",
  ok: "text-[var(--ok)]",
  warn: "text-[var(--warn)]",
  err: "text-[var(--err)]",
  primary: "text-[var(--primary-hover)]",
};

const toneDot: Record<PillTone, string> = {
  neutral: "bg-[var(--ink-subtle)]",
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  err: "bg-[var(--err)]",
  primary: "bg-[var(--primary)]",
};

export function Pill({ tone = "neutral", dot = false, pulse = false, className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)]",
        "border border-[var(--hair)] bg-transparent",
        "px-2 py-[2px] text-[10.5px] font-[var(--font-mono)]",
        toneText[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("h-[5px] w-[5px] rounded-full", toneDot[tone])}
          style={pulse ? { animation: "pulse 1.8s ease-in-out infinite" } : undefined}
        />
      )}
      {children}
    </span>
  );
}
