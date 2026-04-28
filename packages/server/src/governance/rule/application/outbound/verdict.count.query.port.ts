/**
 * Outbound port — query verdict status counts for a task. Self-contained.
 * Adapter wraps the legacy verification usecase; will switch to
 * verification.public iservice when verification module exposes it.
 */

export interface VerdictCountResult {
    readonly verified: number;
    readonly contradicted: number;
    readonly unverifiable: number;
}

export interface IVerdictCountQuery {
    countForTask(taskId: string): Promise<VerdictCountResult>;
}
