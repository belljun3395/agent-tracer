import type React from "react";
import { useClipboardCopyState } from "../../lib/ui/useClipboardCopyState.js";
import { useGenerateSummary } from "./useGenerateSummary.js";

export interface CopySummaryButtonProps {
    readonly turnId: string;
    readonly cached: string | null;
    readonly compact?: boolean;
}

export function CopySummaryButton({ turnId, cached, compact = false }: CopySummaryButtonProps): React.JSX.Element {
    const { state, run } = useClipboardCopyState();
    const generate = useGenerateSummary(turnId);

    const label = state === "working"
        ? "Generating…"
        : state === "copied"
            ? "Copied"
            : state === "error"
                ? "Failed — retry"
                : compact
                    ? "Copy"
                    : "Copy summary";

    return (
        <button
            type="button"
            aria-label={compact ? "Copy summary" : undefined}
            disabled={state === "working"}
            onClick={() => void run(async () => {
                if (cached) return cached;
                const generated = await generate.mutateAsync({});
                return generated.summaryMarkdown;
            })}
            className="inline-flex min-w-[7rem] items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-2 py-1 text-[0.7rem] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:cursor-wait disabled:opacity-60"
        >
            {label}
        </button>
    );
}
