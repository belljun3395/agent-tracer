import type {
    TaskTurnSummary,
    TimelineEventRecord,
    TurnGroup,
    TurnSegment,
    VerdictStatus,
} from "../../../types.js";

export interface GroupVerdictSummary {
    readonly status: VerdictStatus | null;
    readonly hasOpenTurn: boolean;
    readonly rulesEvaluatedCount: number;
}

export function findTurnSummaryForEvent(
    event: TimelineEventRecord | null,
    turnSummaries: readonly TaskTurnSummary[],
): TaskTurnSummary | null {
    if (!event || turnSummaries.length === 0) return null;
    const eventTime = Date.parse(event.createdAt);
    if (!Number.isFinite(eventTime)) return null;
    const candidates = turnSummaries
        .filter((turn) => event.sessionId === undefined || turn.sessionId === event.sessionId)
        .filter((turn) => isTimeWithinTurn(eventTime, turn))
        .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return candidates[0] ?? null;
}

export function summarizeGroupVerdict(
    group: TurnGroup,
    segments: readonly TurnSegment[],
    turnSummaries: readonly TaskTurnSummary[],
): GroupVerdictSummary | null {
    const relevant = new Map<string, TaskTurnSummary>();
    for (const segment of segments) {
        if (segment.isPrelude || segment.turnIndex < group.from || segment.turnIndex > group.to) continue;
        const turn = findTurnSummaryForSegment(segment, turnSummaries);
        if (turn) relevant.set(turn.id, turn);
    }
    const turns = [...relevant.values()];
    if (turns.length === 0) return null;
    return {
        status: aggregateVerdict(turns.map((turn) => turn.aggregateVerdict)),
        hasOpenTurn: turns.some((turn) => turn.status === "open"),
        rulesEvaluatedCount: turns.reduce((sum, turn) => sum + turn.rulesEvaluatedCount, 0),
    };
}

function findTurnSummaryForSegment(
    segment: TurnSegment,
    turnSummaries: readonly TaskTurnSummary[],
): TaskTurnSummary | null {
    for (const event of segment.events) {
        const turn = findTurnSummaryForEvent(event, turnSummaries);
        if (turn) return turn;
    }
    return null;
}

function isTimeWithinTurn(eventTime: number, turn: TaskTurnSummary): boolean {
    const start = Date.parse(turn.startedAt);
    if (!Number.isFinite(start) || eventTime < start) return false;
    if (turn.endedAt === null) return true;
    const end = Date.parse(turn.endedAt);
    return Number.isFinite(end) && eventTime <= end;
}

function aggregateVerdict(statuses: readonly (VerdictStatus | null)[]): VerdictStatus | null {
    const priority: Record<VerdictStatus, number> = {
        contradicted: 3,
        unverifiable: 2,
        verified: 1,
    };
    let worst: VerdictStatus | null = null;
    for (const status of statuses) {
        if (!status) continue;
        if (!worst || priority[status] > priority[worst]) worst = status;
    }
    return worst;
}
