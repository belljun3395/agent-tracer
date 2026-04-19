import type React from "react";
import { useCallback, useState } from "react";
import { buildEvaluatePrompt, type EvaluatePromptOptions } from "../../types.js";
import { copyToClipboard } from "../lib/ui/clipboard.js";
import { cn } from "../lib/ui/cn.js";

type EvaluatePromptButtonProps = EvaluatePromptOptions;

export function EvaluatePromptButton(props: EvaluatePromptButtonProps): React.JSX.Element {
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(() => {
        const prompt = buildEvaluatePrompt(props);
        void copyToClipboard(prompt).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [props]);

    return (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-[0.85rem] font-semibold text-[var(--text-1)]">Save to Library via Claude</span>
                    <span className="rounded-full border border-[var(--accent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
                        MCP
                    </span>
                </div>

                <p className="m-0 text-[0.76rem] leading-relaxed text-[var(--text-2)]">
                    Copies a prompt that instructs Claude to call{" "}
                    <code className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[0.7rem] text-[var(--text-1)]">
                        monitor_evaluate_task
                    </code>{" "}
                    and save this workflow to your library automatically.
                </p>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[0.72rem] text-[var(--text-3)]">
                        <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5">Copy</span>
                        <span>→</span>
                        <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5">Paste to Claude</span>
                        <span>→</span>
                        <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5">Auto-saved</span>
                    </div>
                    <button
                        type="button"
                        className={cn(
                            "shrink-0 rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-all",
                            copied
                                ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                                : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:opacity-90"
                        )}
                        onClick={handleCopy}
                    >
                        {copied ? "Copied ✓" : "Copy Prompt"}
                    </button>
                </div>
            </div>
        </div>
    );
}
