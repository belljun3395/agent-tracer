import type React from "react";
import { truncate } from "../../lib/text/truncate.js";
import type { TurnCardSummary } from "./types.js";
import { verdictIcon, verdictLabel, verdictStyle } from "./verdict-styles.js";

interface TurnCardProps {
    readonly turn: TurnCardSummary;
    readonly onOpenReceipt: (turnId: string) => void;
    readonly isSelected?: boolean;
}

export function TurnCard({ turn, onOpenReceipt, isSelected = false }: TurnCardProps): React.JSX.Element {
    const style = verdictStyle(turn.aggregateVerdict);
    const verdictText = formatVerdictSummary(turn);
    const showCheckedSubtitle = turn.aggregateVerdict == null && turn.rulesEvaluatedCount > 0;

    function handleClick(): void {
        onOpenReceipt(turn.id);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenReceipt(turn.id);
        }
    }

    return (
        <article
            role="button"
            tabIndex={0}
            aria-label={`Open receipt for turn ${turn.taskIndex}`}
            aria-pressed={isSelected}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="mb-2.5 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-1)] transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 aria-pressed:bg-[var(--surface-2)] aria-pressed:ring-2 aria-pressed:ring-[var(--accent)]"
            style={{ borderLeft: `4px solid ${style.borderColor}` }}
        >
            <header className="mb-1.5 flex items-start justify-between gap-2 text-[0.68rem] text-[var(--text-3)]">
                <span>
                    <strong className="text-[var(--text-1)]">Turn {turn.taskIndex}</strong>
                    {" · "}
                    <code className="text-[0.62rem] text-[var(--text-3)]" title={`Session ${turn.sessionId} · session-local index ${turn.index}`}>
                        {turn.sessionId.slice(0, 4)}
                    </code>
                    {" · "}
                    {formatTimeShort(turn.startedAt)}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                    <span style={{ color: style.chipFg }} className="font-semibold">
                        {verdictIcon(turn.aggregateVerdict)} {verdictText}
                    </span>
                    {showCheckedSubtitle && (
                        <span className="text-[0.6rem] text-[var(--text-3)]">
                            {turn.rulesEvaluatedCount} rule{turn.rulesEvaluatedCount === 1 ? "" : "s"} evaluated
                        </span>
                    )}
                </div>
            </header>
            {turn.askedText && (
                <p className="mb-1 text-[0.74rem] text-[var(--text-2)]">
                    <span className="mr-1 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-[var(--text-3)]">Asked</span>
                    &ldquo;{truncate(turn.askedText, 120)}&rdquo;
                </p>
            )}
            <p className="mb-1 text-[0.78rem] text-[var(--text-1)]">
                &ldquo;{truncate(turn.assistantText, 180)}&rdquo;
            </p>
            {turn.previewLines.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[0.7rem] text-[var(--text-2)]">
                    {turn.previewLines.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
            )}
        </article>
    );
}

function formatVerdictSummary(t: TurnCardSummary): string {
    if (t.aggregateVerdict == null) {
        // Distinguish "no active rules" from "rules ran but nothing triggered".
        return t.rulesEvaluatedCount > 0 ? "all clear" : verdictLabel(null);
    }
    const c = t.verdictCount;
    if (c.contradicted > 0) return `${c.contradicted} contradicted`;
    if (c.unverifiable > 0) return `${c.unverifiable} unverifiable`;
    return "all verified";
}

function formatTimeShort(iso: string): string {
    // ISO → "HH:MM" local. Guard against invalid timestamps.
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
