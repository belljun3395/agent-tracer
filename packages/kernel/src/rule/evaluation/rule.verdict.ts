import { isTurnHaltingSeverity } from "../definition/rule.vocabulary.js";

/** 규칙 하나에 대한 판정의 수명이며, open만 아직 살아 있는 상태다. */
export const VERDICT_STATUS = {
    open: "open",
    satisfied: "satisfied",
    unmet: "unmet",
    unknown: "unknown",
} as const;

export const VERDICT_STATUSES = [
    VERDICT_STATUS.open,
    VERDICT_STATUS.satisfied,
    VERDICT_STATUS.unmet,
    VERDICT_STATUS.unknown,
] as const;

export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

/** unknown은 우리가 못 본 것이지 안 한 것이 아니므로 그때만 단언할 수 없다. */
export function isConfidentVerdict(status: VerdictStatus): boolean {
    return status !== VERDICT_STATUS.unknown;
}

export function isTerminalVerdict(status: VerdictStatus): boolean {
    return status !== VERDICT_STATUS.open;
}

/** 이만큼 알렸는데도 이행되지 않으면 그만 막고 사람에게 넘긴다. */
export const NUDGE_LIMIT = 3;

export function isEscalated(status: VerdictStatus, nudgeCount: number): boolean {
    return status === VERDICT_STATUS.open && nudgeCount >= NUDGE_LIMIT;
}

/** 태스크가 끝나면 살아 있던 판정은 미이행으로 확정된다. */
export function concludeAtTaskEnd(status: VerdictStatus): VerdictStatus {
    return status === VERDICT_STATUS.open ? VERDICT_STATUS.unmet : status;
}

const STATUS_RANK: Record<VerdictStatus, number> = {
    unmet: 4,
    open: 3,
    unknown: 2,
    satisfied: 1,
};

export interface WeightedVerdict {
    readonly status: VerdictStatus;
    readonly severity: string;
}

/** 턴 요약은 턴을 붙잡을 수 있는 규칙만 반영하며, 기록만 하는 규칙은 턴의 결론을 바꾸지 않는다. */
export function aggregateVerdictStatus(verdicts: readonly WeightedVerdict[]): VerdictStatus | null {
    let worst: VerdictStatus | null = null;
    for (const verdict of verdicts) {
        if (!isTurnHaltingSeverity(verdict.severity)) continue;
        if (worst === null || STATUS_RANK[verdict.status] > STATUS_RANK[worst]) worst = verdict.status;
    }
    return worst;
}
