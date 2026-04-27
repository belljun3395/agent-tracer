/**
 * Public iservice — verdict count totals for a task.
 * Consumed by the rule module's task verdict-counts endpoint.
 */

export interface VerdictCountTotals {
    readonly verified: number;
    readonly contradicted: number;
    readonly unverifiable: number;
}

export interface IVerdictCount {
    countForTask(taskId: string): Promise<VerdictCountTotals>;
}
