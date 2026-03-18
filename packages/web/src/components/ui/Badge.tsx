import { forwardRef } from "react";
import type React from "react";

import { cn } from "../../lib/ui/cn.js";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
  readonly tone?: BadgeTone;
  readonly size?: BadgeSize;
}

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)]",
  accent: "border-[var(--accent-light)] bg-[var(--accent-light)] text-[var(--accent)]",
  success: "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]",
  warning: "border-[var(--rules-bg)] bg-[var(--rules-bg)] text-[var(--rules)]",
  danger: "border-[var(--err-bg)] bg-[var(--err-bg)] text-[var(--err)]"
};

const badgeSizes: Record<BadgeSize, string> = {
  xs: "px-1.5 py-0.5 text-[0.6rem]",
  sm: "px-2 py-0.5 text-[0.67rem]",
  md: "px-2.5 py-1 text-xs"
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    className,
    tone = "neutral",
    size = "sm",
    ...props
  },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-semibold leading-none whitespace-nowrap",
        badgeTones[tone],
        badgeSizes[size],
        className
      )}
      {...props}
    />
  );
});
