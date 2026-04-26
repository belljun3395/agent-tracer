import { forwardRef } from "react";
import type React from "react";
import { cn } from "~app/lib/ui/cn.js";
type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
type BadgeSize = "xs" | "sm" | "md";
interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
    readonly tone?: BadgeTone;
    readonly size?: BadgeSize;
}
const badgeTones: Record<BadgeTone, string> = {
    neutral: "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-2)]",
    accent: "border-[color-mix(in_srgb,var(--accent)_16%,var(--border))] bg-[var(--accent-light)] text-[var(--accent)]",
    success: "border-[color-mix(in_srgb,var(--ok)_14%,var(--border))] bg-[var(--ok-bg)] text-[var(--ok)]",
    warning: "border-[color-mix(in_srgb,var(--warn)_18%,var(--border))] bg-[var(--warn-bg)] text-[var(--warn)]",
    danger: "border-[color-mix(in_srgb,var(--err)_18%,var(--border))] bg-[var(--err-bg)] text-[var(--err)]"
};
const badgeSizes: Record<BadgeSize, string> = {
    xs: "px-1.5 py-0.5 text-[0.58rem]",
    sm: "px-1.75 py-0.5 text-[0.64rem]",
    md: "px-2.25 py-0.75 text-[0.71rem]"
};
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge({ className, tone = "neutral", size = "sm", ...props }, ref) {
    return (<span ref={ref} className={cn("inline-flex items-center justify-center rounded-[var(--radius-md)] border font-semibold leading-none whitespace-nowrap", badgeTones[tone], badgeSizes[size], className)} {...props}/>);
});
