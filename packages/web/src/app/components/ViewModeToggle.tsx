import type React from "react";
import type { ViewMode } from "../../state.js";
import { cn } from "../lib/ui/cn.js";

const OPTIONS: ReadonlyArray<{ readonly value: ViewMode; readonly label: string }> = [
    { value: "events", label: "Timeline" },
    { value: "turns", label: "Turn view" },
];

export interface ViewModeToggleProps {
    readonly value: ViewMode;
    readonly onChange: (next: ViewMode) => void;
    readonly className?: string;
    readonly extra?: React.ReactNode;
    readonly suppressSelection?: boolean;
}

export function ViewModeToggle({ value, onChange, className, extra, suppressSelection = false }: ViewModeToggleProps): React.JSX.Element {
    const btnClass = "h-6 shrink-0 rounded-[var(--radius-sm)] px-2 text-[0.7rem] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
    return (
        <div
            role="radiogroup"
            aria-label="View mode"
            className={cn(
                "inline-flex h-7 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-[0.7rem]",
                className,
            )}
        >
            {OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={!suppressSelection && value === opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        btnClass,
                        !suppressSelection && value === opt.value
                            ? "bg-[var(--surface)] text-[var(--text-1)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                            : "text-[var(--text-3)] hover:text-[var(--text-1)]",
                    )}
                >
                    {opt.label}
                </button>
            ))}
            {extra != null && (
                <>
                    <div aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" />
                    {extra}
                </>
            )}
        </div>
    );
}
