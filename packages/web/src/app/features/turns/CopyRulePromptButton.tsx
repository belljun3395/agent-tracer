import type React from "react";
import { useClipboardCopyState } from "../../lib/ui/useClipboardCopyState.js";
import { buildRulePrompt, isTurnReceipt, type RulePromptSource } from "./buildRulePrompt.js";
import type { TurnReceipt } from "./types.js";

export interface CopyRulePromptButtonProps {
    readonly source: RulePromptSource | TurnReceipt;
    readonly compact?: boolean;
}

function isDisabledSource(source: RulePromptSource | TurnReceipt): boolean {
    if (isTurnReceipt(source)) return source.askedText == null;
    if (source.kind === "turn") return source.receipt.askedText == null;
    return source.text.length === 0;
}

export function CopyRulePromptButton({ source, compact = false }: CopyRulePromptButtonProps): React.JSX.Element {
    const { state, run } = useClipboardCopyState();
    const disabled = isDisabledSource(source);

    const label = state === "copied"
        ? "Copied"
        : state === "error"
            ? "Failed — retry"
            : compact
                ? "Rule"
                : "Suggest rules";

    const title = disabled
        ? "No user message in this turn — cannot suggest rules"
        : "Copy a rule-suggestion prompt for this turn's ASKED";

    return (
        <button
            type="button"
            aria-label={compact ? "Copy rule suggestion prompt" : undefined}
            disabled={disabled}
            title={title}
            onClick={() => {
                if (disabled) return;
                void run(() => buildRulePrompt(source));
            }}
            className="inline-flex min-w-[7rem] items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-2 py-1 text-[0.7rem] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
            {label}
        </button>
    );
}
