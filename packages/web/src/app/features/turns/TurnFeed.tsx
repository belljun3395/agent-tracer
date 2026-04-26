import type React from "react";
import { Fragment } from "react";
import { useTurns } from "./useTurns.js";
import type { VerdictFilter } from "./types.js";
import { TurnCard } from "./TurnCard.js";
import { VerdictFilterBar } from "./VerdictFilterBar.js";

export interface TurnFeedProps {
    readonly sessionId?: string;
    readonly taskId?: string;
    readonly verdict: VerdictFilter;
    readonly onVerdictChange?: (next: VerdictFilter) => void;
    readonly onSelect: (turnId: string) => void;
}

interface SessionDividerProps {
    readonly sessionId: string;
}

function SessionDivider({ sessionId }: SessionDividerProps): React.JSX.Element {
    return (
        <div
            className="my-2 flex items-center gap-2 text-[0.62rem] uppercase tracking-wide text-[var(--text-3)]"
            data-testid="session-divider"
        >
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span>Session · {sessionId.slice(0, 8)}</span>
            <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
    );
}

export function TurnFeed(props: TurnFeedProps): React.JSX.Element {
    const query = useTurns({
        ...(props.sessionId ? { sessionId: props.sessionId } : {}),
        ...(props.taskId ? { taskId: props.taskId } : {}),
        verdict: props.verdict,
    });

    const items = query.data?.items ?? [];
    const isFiltered = props.verdict !== "all";

    return (
        <div className="flex h-full flex-col" data-testid="turn-feed">
            {props.onVerdictChange && (
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">
                        Verdict filter
                    </span>
                    <VerdictFilterBar value={props.verdict} onChange={props.onVerdictChange} />
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-3">
                {query.isLoading ? (
                    <p className="text-[0.78rem] text-[var(--text-3)]">Loading turns…</p>
                ) : query.isError ? (
                    <p className="text-[0.78rem] text-[var(--err)]">
                        Failed to load turns: {query.error instanceof Error ? query.error.message : String(query.error)}
                    </p>
                ) : items.length === 0 ? (
                    <EmptyState isFiltered={isFiltered} verdict={props.verdict} {...(props.onVerdictChange ? { onResetFilter: () => props.onVerdictChange?.("all") } : {})} />
                ) : (
                    items.map((turn, i) => {
                        const prev = i > 0 ? items[i - 1] : undefined;
                        const showDivider = prev !== undefined && prev.sessionId !== turn.sessionId;
                        return (
                            <Fragment key={turn.id}>
                                {showDivider && <SessionDivider sessionId={turn.sessionId} />}
                                <TurnCard turn={turn} onOpenReceipt={props.onSelect} />
                            </Fragment>
                        );
                    })
                )}
            </div>
        </div>
    );
}

interface EmptyStateProps {
    readonly isFiltered: boolean;
    readonly verdict: VerdictFilter;
    readonly onResetFilter?: () => void;
}

function EmptyState({ isFiltered, verdict, onResetFilter }: EmptyStateProps): React.JSX.Element {
    if (!isFiltered) {
        return (
            <p className="text-[0.78rem] text-[var(--text-3)]">
                No turns yet — agent activity will appear here.
            </p>
        );
    }
    return (
        <div className="flex flex-col items-start gap-2 text-[0.78rem] text-[var(--text-3)]">
            <span>
                No turns match the <strong className="text-[var(--text-2)]">{verdict}</strong> filter.
            </span>
            {onResetFilter && (
                <button
                    type="button"
                    onClick={onResetFilter}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-2 py-1 text-[0.7rem] text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
                >
                    Show all turns
                </button>
            )}
        </div>
    );
}
