import type { VERDICT_STATUSES } from "../const/verdict.const.js";

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

export interface VerdictTally {
    verified: number;
    unverifiable: number;
    contradicted: number;
}
