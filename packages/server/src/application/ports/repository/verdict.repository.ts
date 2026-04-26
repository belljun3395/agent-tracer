import type { TurnVerdict, VerdictStatus } from "~domain/verification/index.js";

export interface VerdictUpsertInput {
    readonly id: string;
    readonly turnId: string;
    readonly ruleId: string;
    readonly status: VerdictStatus;
    readonly detail: {
        readonly matchedPhrase?: string;
        readonly expectedPattern?: string;
        readonly actualToolCalls?: readonly string[];
        readonly matchedToolCalls?: readonly string[];
    };
    readonly evaluatedAt: string;
}

export interface IVerdictRepository {
    insert(input: VerdictUpsertInput): Promise<TurnVerdict>;
    findByTurnId(turnId: string): Promise<readonly TurnVerdict[]>;
    countBySessionAndStatus(sessionId: string, status: VerdictStatus): Promise<number>;
    deleteByRuleId(ruleId: string): Promise<void>;
    deleteByTurnId(turnId: string): Promise<void>;
}
