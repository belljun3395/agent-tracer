import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { cn } from "~app/lib/ui/cn.js";

export function HelpTooltip({
    text,
    className,
}: {
    readonly text: string;
    readonly className?: string;
}): React.JSX.Element {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({
        top: 0,
        left: 0,
        visibility: "hidden",
    });

    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current || typeof window === "undefined") {
            return;
        }

        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipWidth = Math.min(320, window.innerWidth - 24);
        const preferredLeft = rect.right - tooltipWidth;
        const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - tooltipWidth - 12));
        const showAbove = rect.bottom + 12 + 96 > window.innerHeight && rect.top > 120;
        const top = showAbove ? rect.top - 12 : rect.bottom + 8;

        setTooltipStyle({
            left,
            top,
            visibility: "visible",
            transform: showAbove ? "translateY(-100%)" : undefined,
            width: tooltipWidth,
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || typeof window === "undefined") {
            return;
        }

        const close = (): void => setIsOpen(false);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [isOpen]);

    return (
      <span className={cn("inline-flex shrink-0", className)}>
        <button
          aria-label={text}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--bg-subtle)] text-[0.62rem] font-semibold leading-none text-[var(--text-3)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:border-[var(--accent)] focus-visible:bg-[var(--surface-2)] focus-visible:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]"
          onBlur={() => setIsOpen(false)}
          onFocus={() => setIsOpen(true)}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          type="button"
          ref={triggerRef}
        >
          ?
        </button>
        {isOpen && typeof document !== "undefined" && createPortal(
          <span
            className="pointer-events-none fixed z-[200] rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[0.72rem] leading-5 text-[var(--text-2)] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            role="tooltip"
            style={tooltipStyle}
          >
            {text}
          </span>,
          document.body
        )}
      </span>
    );
}
