export const VERDICT_STATUSES = ["verified", "unverifiable", "contradicted"] as const;
export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

export interface TurnVerdictDetail {
    matchedPhrase?: string;
    expectedPattern?: string;
    actualToolCalls: string[];
    matchedToolCalls?: string[];
}

export interface TurnVerdict {
    id: string;
    turnId: string;
    ruleId: string;
    status: VerdictStatus;
    detail: TurnVerdictDetail;
    evaluatedAt: string;
}

const VERDICT_PRIORITY: Record<VerdictStatus, number> = {
    contradicted: 3,
    unverifiable: 2,
    verified: 1,
};

const VERDICT_STATUS_SET: ReadonlySet<string> = new Set<string>(VERDICT_STATUSES);

export function isVerdictStatus(value: unknown): value is VerdictStatus {
    return typeof value === "string" && VERDICT_STATUS_SET.has(value);
}

/**
 * Picks the worst verdict status. Priority order is
 * contradicted > unverifiable > verified. Returns null when there are no
 * recognized statuses. Accepts raw strings/null/undefined to ease use from
 * persistence rows where the column is typed as `string | null`.
 */
export function aggregateVerdict(
    statuses: ReadonlyArray<string | null | undefined>,
): VerdictStatus | null {
    let worst: VerdictStatus | null = null;
    for (const status of statuses) {
        if (!isVerdictStatus(status)) continue;
        if (worst === null || VERDICT_PRIORITY[status] > VERDICT_PRIORITY[worst]) {
            worst = status;
        }
    }
    return worst;
}

export interface VerdictTally {
    verified: number;
    unverifiable: number;
    contradicted: number;
}

export function tallyVerdicts(
    statuses: ReadonlyArray<string | null | undefined>,
): VerdictTally {
    const tally: VerdictTally = { verified: 0, unverifiable: 0, contradicted: 0 };
    for (const status of statuses) {
        if (!isVerdictStatus(status)) continue;
        tally[status] += 1;
    }
    return tally;
}
