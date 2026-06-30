export const VERDICT_STATUS = {
    verified: "verified",
    unverifiable: "unverifiable",
    contradicted: "contradicted",
} as const;

export const VERDICT_STATUSES = [
    VERDICT_STATUS.verified,
    VERDICT_STATUS.unverifiable,
    VERDICT_STATUS.contradicted,
] as const;
