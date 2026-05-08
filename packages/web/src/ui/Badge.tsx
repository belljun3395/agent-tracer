import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

type BadgeVariant = "neutral" | "viol" | "appr" | "upd" | "runtime";

interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  readonly variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  neutral:
    "bg-[var(--s2)] text-[var(--ink-muted)] border border-[var(--hair)]",
  viol:
    "bg-[color-mix(in_srgb,var(--err)_16%,transparent)] text-[var(--err)] border-0",
  appr:
    "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-[var(--warn)] border-0",
  upd:
    "bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] text-[var(--primary-hover)] border-0",
  runtime:
    "bg-transparent text-[var(--ink-tertiary)] border-0 font-mono",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-1.5",
        "text-[10px] leading-[14px] font-medium tracking-[0.02em]",
        "font-[var(--font-mono)]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
