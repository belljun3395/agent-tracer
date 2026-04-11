import type { TimelineEvent } from "../monitoring/types.js";
import type { RuntimeEvidenceFeatureId } from "./capabilities.types.js";
export type EvidenceLevel = "proven" | "self_reported" | "inferred" | "unavailable";
export interface EventEvidence {
    readonly level: EvidenceLevel;
    readonly reason: string;
}
export interface RuntimeCoverageItem {
    readonly key: RuntimeEvidenceFeatureId | "semantic_events";
    readonly label: string;
    readonly level: EvidenceLevel;
    readonly note: string;
    readonly automatic?: boolean;
}
export interface RuntimeCoverageSummary {
    readonly defaultLevel: EvidenceLevel;
    readonly summary: string;
    readonly items: readonly RuntimeCoverageItem[];
}
/**
 * Explains how trustworthy an individual event is based on runtime capabilities and metadata.
 */
export declare function getEventEvidence(runtimeSource: string | undefined, event: Pick<TimelineEvent, "kind" | "lane" | "metadata">): EventEvidence;
/**
 * Lists the evidence coverage claims exposed by a runtime adapter for UI/reporting.
 */
export declare function listRuntimeCoverage(runtimeSource: string | undefined): readonly RuntimeCoverageItem[];
/**
 * Summarizes a runtime adapter's overall evidence posture plus itemized coverage details.
 */
export declare function getRuntimeCoverageSummary(runtimeSource: string | undefined): RuntimeCoverageSummary;
//# sourceMappingURL=evidence.d.ts.map