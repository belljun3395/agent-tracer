import type React from "react";
import type { VerdictFilter } from "./types.js";
import { cn } from "../../lib/ui/cn.js";

const OPTIONS: ReadonlyArray<{ readonly value: VerdictFilter; readonly label: string }> = [
    { value: "all", label: "All" },
    { value: "contradicted", label: "Contradicted" },
    { value: "unverifiable", label: "Unverifiable" },
    { value: "verified", label: "Verified" },
];

export interface VerdictFilterBarProps {
    readonly value: VerdictFilter;
    readonly onChange: (next: VerdictFilter) => void;
}

export function VerdictFilterBar({ value, onChange }: VerdictFilterBarProps): React.JSX.Element {
    return (
        <div
            role="radiogroup"
            aria-label="Verdict filter"
            className="inline-flex gap-1 text-[0.7rem]"
        >
            {OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={value === opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "whitespace-nowrap rounded-[var(--radius-sm)] border px-2 py-0.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
                        value === opt.value
                            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                            : "border-[var(--border)] bg-transparent text-[var(--text-2)] hover:text-[var(--text-1)]",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
