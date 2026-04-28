import type { TurnVerdict, VerdictStatus } from "~verification/domain/model/verdict.model.js";

/**
 * Legacy IVerdictRepository contract — self-contained for the SQLite adapter
 * and verification module factory bindings.
 */

export type VerdictStatusPort = VerdictStatus;

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
    findByTurnId(turnId: string): Promise<readonly TurnVerdict[]>;
    countBySessionAndStatus(sessionId: string, status: VerdictStatus): Promise<number>;
    insert(input: VerdictUpsertInput): Promise<TurnVerdict>;
    deleteByRuleId(ruleId: string): Promise<void>;
    deleteByTurnId(turnId: string): Promise<void>;
}
