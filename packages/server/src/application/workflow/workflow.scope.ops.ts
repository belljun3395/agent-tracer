import { segmentEventsByTurn, filterEventsByTurnRange, type TimelineEvent } from "~domain/index.js";

export type WorkflowScopeDetails = {
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
};

export function normalizeWorkflowScopeKey(value?: string | null): string {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "task") return "task";
    if (trimmed === "last-turn") return trimmed;
    const match = /^turn:(\d+)$/.exec(trimmed);
    if (!match) return "task";
    const turnIndex = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(turnIndex) && turnIndex > 0 ? `turn:${turnIndex}` : "task";
}

export function resolveWorkflowScope(scopeKey: string | undefined, events: readonly TimelineEvent[]): WorkflowScopeDetails {
    const normalized = normalizeWorkflowScopeKey(scopeKey);
    if (normalized === "task") {
        return { scopeKey: "task", scopeKind: "task", scopeLabel: "Whole task", turnIndex: null };
    }
    if (normalized === "last-turn") {
        const segments = segmentEventsByTurn(events).filter((s) => !s.isPrelude);
        const lastTurn = segments[segments.length - 1];
        return { scopeKey: normalized, scopeKind: "turn", scopeLabel: "Last turn", turnIndex: lastTurn?.turnIndex ?? null };
    }
    const turnIndex = Number.parseInt(normalized.slice("turn:".length), 10);
    return { scopeKey: normalized, scopeKind: "turn", scopeLabel: `Turn ${turnIndex}`, turnIndex };
}

export function filterWorkflowEventsByScope(events: readonly TimelineEvent[], scopeKey: string): readonly TimelineEvent[] {
    if (scopeKey === "task") return events;
    if (scopeKey === "last-turn") {
        const segments = segmentEventsByTurn(events).filter((s) => !s.isPrelude);
        const lastTurn = segments[segments.length - 1];
        if (!lastTurn) return events;
        return filterEventsByTurnRange(events, { from: lastTurn.turnIndex, to: lastTurn.turnIndex });
    }
    const turnIndex = Number.parseInt(scopeKey.slice("turn:".length), 10);
    if (!Number.isFinite(turnIndex)) return events;
    return filterEventsByTurnRange(events, { from: turnIndex, to: turnIndex });
}
