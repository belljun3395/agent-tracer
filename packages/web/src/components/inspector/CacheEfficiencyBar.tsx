import type React from "react";
import { cn } from "../../lib/ui/cn.js";

interface CacheEfficiencyBarProps {
    readonly inputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly outputTokens: number;
}

/**
 * Visualizes token usage for one assistant turn as a stacked bar.
 *
 * inputTokens = cacheReadTokens + cacheCreateTokens + newInputTokens
 * - cacheRead   : cached tokens (fast/cheap path)
 * - cacheCreate : tokens written to cache this turn
 * - newInput    : uncached new input tokens
 * - output      : generated output tokens
 */
export function CacheEfficiencyBar({
    inputTokens,
    cacheReadTokens,
    cacheCreateTokens,
    outputTokens,
}: CacheEfficiencyBarProps): React.JSX.Element {
    const newInput = Math.max(0, inputTokens - cacheReadTokens - cacheCreateTokens);
    const total = inputTokens + outputTokens;
    const hitRate = inputTokens > 0
        ? Math.round((cacheReadTokens / inputTokens) * 100)
        : 0;

    const pct = (n: number): string =>
        total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "0%";

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                {cacheReadTokens > 0 && (
                    <div
                        className="h-full bg-[var(--ok)]"
                        style={{ width: pct(cacheReadTokens) }}
                        title={`Cache read: ${cacheReadTokens.toLocaleString()} tokens`}
                    />
                )}
                {cacheCreateTokens > 0 && (
                    <div
                        className="h-full bg-[color-mix(in_srgb,var(--ok)_50%,var(--accent))]"
                        style={{ width: pct(cacheCreateTokens) }}
                        title={`Cache write: ${cacheCreateTokens.toLocaleString()} tokens`}
                    />
                )}
                {newInput > 0 && (
                    <div
                        className="h-full bg-[var(--accent)]"
                        style={{ width: pct(newInput) }}
                        title={`New input: ${newInput.toLocaleString()} tokens`}
                    />
                )}
                {outputTokens > 0 && (
                    <div
                        className="h-full bg-[var(--text-3)]"
                        style={{ width: pct(outputTokens) }}
                        title={`Output: ${outputTokens.toLocaleString()} tokens`}
                    />
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-[var(--text-3)]">
                <LegendItem color="bg-[var(--ok)]" label="Cache read" value={cacheReadTokens} />
                <LegendItem
                    color="bg-[color-mix(in_srgb,var(--ok)_50%,var(--accent))]"
                    label="Cache write"
                    value={cacheCreateTokens}
                />
                <LegendItem color="bg-[var(--accent)]" label="New input" value={newInput} />
                <LegendItem color="bg-[var(--text-3)]" label="Output" value={outputTokens} />
                <span className={cn(
                    "ml-auto font-semibold",
                    hitRate >= 70 ? "text-[var(--ok)]" :
                    hitRate >= 30 ? "text-[var(--warn)]" : "text-[var(--text-2)]"
                )}>
                    {hitRate}% cache hit
                </span>
            </div>
        </div>
    );
}

function LegendItem({ color, label, value }: {
    readonly color: string;
    readonly label: string;
    readonly value: number;
}): React.JSX.Element | null {
    if (value <= 0) return null;
    return (
        <span className="flex items-center gap-1">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />
            {label}: {value.toLocaleString()}
        </span>
    );
}
