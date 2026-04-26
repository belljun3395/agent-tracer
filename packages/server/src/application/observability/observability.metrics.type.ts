export type {
    ObservabilityPhase,
    ObservabilityPhaseBucket,
    ObservabilityPhaseStat,
    ObservabilityFileCount,
    ObservabilityTagCount,
    ObservabilityTaskSignals,
    ObservabilityTaskFocus,
    ObservabilityEvidenceCount,
    ObservabilityTaskEvidence,
    ObservabilityRuleAuditSummary,
    ObservabilityRuleEnforcementSummary,
    TaskObservabilitySummary,
    ObservabilityRuntimeSourceSummary,
    ObservabilityOverviewSummary,
} from "~domain/observability/observability.metrics.type.js";
import type { MentionedFileVerification } from "../views/file.verification.type.js";
import type { TaskObservabilitySummary, ObservabilityOverviewSummary } from "~domain/observability/observability.metrics.type.js";

export interface TaskObservabilityResponse {
    readonly observability: TaskObservabilitySummary;
    readonly mentionedFileVerifications: readonly MentionedFileVerification[];
}

export interface ObservabilityOverviewResponse {
    readonly observability: ObservabilityOverviewSummary;
}
