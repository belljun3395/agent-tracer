import type { RuleId, RuntimeSource, TaskId } from "@monitor/domain";
import type { EvidenceLevel, RuntimeCoverageItem } from "@monitor/domain";
export type ObservabilityPhase = "planning" | "exploration" | "implementation" | "verification" | "coordination";
export type ObservabilityPhaseBucket = ObservabilityPhase | "waiting";
export interface ObservabilityPhaseStat {
    readonly phase: ObservabilityPhase;
    readonly durationMs: number;
    readonly share: number;
}
export interface ObservabilityFileCount {
    readonly path: string;
    readonly count: number;
}
export interface ObservabilityTagCount {
    readonly tag: string;
    readonly count: number;
}
export interface ObservabilityTaskSignals {
    rawUserMessages: number;
    followUpMessages: number;
    questionsAsked: number;
    questionsClosed: number;
    questionClosureRate: number;
    todosAdded: number;
    todosCompleted: number;
    todoCompletionRate: number;
    thoughts: number;
    toolCalls: number;
    terminalCommands: number;
    verifications: number;
    backgroundTransitions: number;
    coordinationActivities: number;
    exploredFiles: number;
}
export interface ObservabilityTaskFocus {
    readonly topFiles: readonly ObservabilityFileCount[];
    readonly topTags: readonly ObservabilityTagCount[];
}
export interface ObservabilityEvidenceCount {
    readonly level: EvidenceLevel;
    readonly count: number;
}
export interface ObservabilityTaskEvidence {
    readonly defaultLevel: EvidenceLevel;
    readonly summary: string;
    readonly breakdown: readonly ObservabilityEvidenceCount[];
    readonly runtimeCoverage: readonly RuntimeCoverageItem[];
}
export interface ObservabilityRuleAuditSummary {
    readonly total: number;
    readonly checks: number;
    readonly passes: number;
    readonly violations: number;
    readonly other: number;
}
export interface ObservabilityRuleEnforcementSummary {
    readonly warnings: number;
    readonly blocked: number;
    readonly approvalRequested: number;
    readonly approved: number;
    readonly rejected: number;
    readonly bypassed: number;
    readonly activeState: "clear" | "warning" | "blocked" | "approval_required";
    readonly activeRuleId: RuleId | undefined;
    readonly activeLabel: string | undefined;
}
export interface TaskObservabilitySummary {
    readonly taskId: TaskId;
    readonly runtimeSource?: RuntimeSource;
    readonly totalDurationMs: number;
    readonly activeDurationMs: number;
    readonly totalEvents: number;
    readonly traceLinkCount: number;
    readonly traceLinkedEventCount: number;
    readonly traceLinkEligibleEventCount: number;
    readonly traceLinkCoverageRate: number;
    readonly actionRegistryGapCount: number;
    readonly actionRegistryEligibleEventCount: number;
    readonly phaseBreakdown: readonly ObservabilityPhaseStat[];
    readonly sessions: {
        readonly total: number;
        readonly resumed: number;
        readonly open: number;
    };
    readonly signals: ObservabilityTaskSignals;
    readonly focus: ObservabilityTaskFocus;
    readonly evidence: ObservabilityTaskEvidence;
    readonly rules: ObservabilityRuleAuditSummary;
    readonly ruleEnforcement: ObservabilityRuleEnforcementSummary;
}
export interface ObservabilityRuntimeSourceSummary {
    readonly runtimeSource: RuntimeSource | "unknown";
    readonly taskCount: number;
    readonly runningTaskCount: number;
    readonly promptCaptureRate: number;
    readonly traceLinkedTaskRate: number;
}
export interface ObservabilityOverviewSummary {
    readonly generatedAt: string;
    readonly totalTasks: number;
    readonly runningTasks: number;
    readonly staleRunningTasks: number;
    readonly avgDurationMs: number;
    readonly avgEventsPerTask: number;
    readonly promptCaptureRate: number;
    readonly traceLinkedTaskRate: number;
    readonly tasksWithQuestions: number;
    readonly tasksWithTodos: number;
    readonly tasksWithCoordination: number;
    readonly tasksWithBackground: number;
    readonly tasksAwaitingApproval: number;
    readonly tasksBlockedByRule: number;
    readonly runtimeSources: readonly ObservabilityRuntimeSourceSummary[];
}
export interface TaskObservabilityResponse {
    readonly observability: TaskObservabilitySummary;
}
export interface ObservabilityOverviewResponse {
    readonly observability: ObservabilityOverviewSummary;
}
