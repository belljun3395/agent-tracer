import type { TimelineEvent } from "../monitoring/timeline.event.js";
import { filterEventsByTurnRange, segmentEventsByTurn } from "./segments.js";

export type WorkflowScopeDetails = {
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
};

const TURN_RANGE_RE = /^turns:(\d+)-(\d+)$/;
const SINGLE_TURN_RE = /^turn:(\d+)$/;

export function normalizeWorkflowScopeKey(value?: string | null): string {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "task") return "task";
    if (trimmed === "last-turn") return trimmed;
    const single = SINGLE_TURN_RE.exec(trimmed);
    if (single) {
        const turnIndex = Number.parseInt(single[1] ?? "", 10);
        return Number.isFinite(turnIndex) && turnIndex > 0 ? `turn:${turnIndex}` : "task";
    }
    const range = TURN_RANGE_RE.exec(trimmed);
    if (range) {
        const from = Number.parseInt(range[1] ?? "", 10);
        const to = Number.parseInt(range[2] ?? "", 10);
        if (Number.isFinite(from) && Number.isFinite(to) && from > 0 && to >= from) {
            return from === to ? `turn:${from}` : `turns:${from}-${to}`;
        }
    }
    return "task";
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
    const range = TURN_RANGE_RE.exec(normalized);
    if (range) {
        const from = Number.parseInt(range[1] ?? "", 10);
        const to = Number.parseInt(range[2] ?? "", 10);
        return {
            scopeKey: normalized,
            scopeKind: "turn",
            scopeLabel: `Turns ${from}–${to}`,
            turnIndex: null,
        };
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
    const range = TURN_RANGE_RE.exec(scopeKey);
    if (range) {
        const from = Number.parseInt(range[1] ?? "", 10);
        const to = Number.parseInt(range[2] ?? "", 10);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return events;
        return filterEventsByTurnRange(events, { from, to });
    }
    const turnIndex = Number.parseInt(scopeKey.slice("turn:".length), 10);
    if (!Number.isFinite(turnIndex)) return events;
    return filterEventsByTurnRange(events, { from: turnIndex, to: turnIndex });
}
