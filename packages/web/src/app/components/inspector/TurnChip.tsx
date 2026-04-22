import type React from "react";
import { cn } from "../../lib/ui/cn.js";

export interface TurnChipProps {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
    readonly title?: string | undefined;
    readonly muted?: boolean;
    readonly className?: string;
}

export function TurnChip({
    active,
    children,
    onClick,
    title,
    muted = false,
    className,
}: TurnChipProps): React.JSX.Element {
    return (
        <button
            type="button"
            title={title}
            className={cn(
                "rounded-[999px] border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors",
                active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#fff]"
                    : muted
                        ? "border-dashed border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:text-[var(--text-2)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)]",
                className,
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
