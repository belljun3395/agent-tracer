import type { TurnVerdict, VerdictStatus } from "~domain/verification/index.js";

export interface VerdictCreateInput {
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
    insert(input: VerdictCreateInput): Promise<TurnVerdict>;
    findByTurnId(turnId: string): Promise<readonly TurnVerdict[]>;
    countBySessionAndStatus(sessionId: string, status: VerdictStatus): Promise<number>;
    countUnacknowledgedContradicted(sessionId: string): Promise<number>;
    existsByTurnIdAndRuleId(turnId: string, ruleId: string): Promise<boolean>;
    markAcknowledged(turnId: string): Promise<void>;
    deleteByTurnId(turnId: string): Promise<void>;
}
