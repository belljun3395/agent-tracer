import type { TimelineEvent } from "../monitoring/types.js";
import type { ReusableTaskSnapshot, WorkflowEvaluationData } from "./types.js";
export interface BuildReusableTaskSnapshotInput {
    readonly objective: string;
    readonly events: readonly TimelineEvent[];
    readonly evaluation?: Partial<WorkflowEvaluationData> | null;
}
/**
 * Distills a raw event timeline into the reusable snapshot stored with evaluations and previews.
 */
export declare function buildReusableTaskSnapshot({ objective, events, evaluation }: BuildReusableTaskSnapshotInput): ReusableTaskSnapshot;
//# sourceMappingURL=snapshot.d.ts.map