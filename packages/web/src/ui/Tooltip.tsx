import * as RxTooltip from "@radix-ui/react-tooltip";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

interface TooltipProps {
  readonly children: ReactNode;
  readonly content: ReactNode;
  readonly side?: RxTooltip.TooltipContentProps["side"];
  readonly delayMs?: number;
}

/**
 * Convenience wrapper — at the top of the app tree, wrap with
 * `<RxTooltip.Provider>` (or use a single global provider in App.tsx).
 */
export function Tooltip({ children, content, side = "bottom", delayMs = 250 }: TooltipProps) {
  return (
    <RxTooltip.Root delayDuration={delayMs}>
      <RxTooltip.Trigger asChild>{children}</RxTooltip.Trigger>
      <RxTooltip.Portal>
        <TooltipContent side={side}>{content}</TooltipContent>
      </RxTooltip.Portal>
    </RxTooltip.Root>
  );
}

const TooltipContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RxTooltip.Content>
>(function TooltipContent({ className, ...props }, ref) {
  return (
    <RxTooltip.Content
      ref={ref}
      sideOffset={6}
      className={cn(
        "rounded-[var(--radius-sm)] bg-[var(--s3)] border border-[var(--hair)]",
        "px-2 py-1 text-[11px] text-[var(--ink-muted)]",
        "shadow-[0_8px_20px_rgba(0,0,0,0.4)]",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    />
  );
});

export const TooltipProvider = RxTooltip.Provider;
