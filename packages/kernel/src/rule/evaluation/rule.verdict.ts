/** 규칙 판정의 집계 가능한 결과 어휘다. */
export const VERDICT_STATUS = {
    verified: "verified",
    contradicted: "contradicted",
    unverifiable: "unverifiable",
} as const;

export const VERDICT_STATUSES = [
    VERDICT_STATUS.verified,
    VERDICT_STATUS.contradicted,
    VERDICT_STATUS.unverifiable,
] as const;

export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

const VERDICT_PRIORITY: Record<VerdictStatus, number> = {
    contradicted: 3,
    unverifiable: 2,
    verified: 1,
};

export function aggregateVerdictStatus(statuses: readonly VerdictStatus[]): VerdictStatus | null {
    let worst: VerdictStatus | null = null;
    for (const status of statuses) {
        if (worst === null || VERDICT_PRIORITY[status] > VERDICT_PRIORITY[worst]) worst = status;
    }
    return worst;
}
