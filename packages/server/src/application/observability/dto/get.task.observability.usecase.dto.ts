export interface GetTaskObservabilityUseCaseIn {
    readonly taskId: string;
}

export type ObservabilityEvidenceLevelUseCaseDto = "proven" | "inferred" | "self_reported" | "unavailable";
export type ObservabilityPhaseUseCaseDto = "planning" | "exploration" | "implementation" | "verification" | "coordination";
export type ObservabilityRuleStateUseCaseDto = "clear" | "warning" | "blocked" | "approval_required";

export interface ObservabilityPhaseStatUseCaseDto {
    readonly phase: ObservabilityPhaseUseCaseDto;
    readonly durationMs: number;
    readonly share: number;
}

export interface ObservabilityCountUseCaseDto {
    readonly path?: string;
    readonly tag?: string;
    readonly count: number;
}

export interface ObservabilityTaskSignalsUseCaseDto {
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

export interface ObservabilityTaskFocusUseCaseDto {
    readonly topFiles: readonly (ObservabilityCountUseCaseDto & { readonly path: string })[];
    readonly topTags: readonly (ObservabilityCountUseCaseDto & { readonly tag: string })[];
}

export interface ObservabilityEvidenceCountUseCaseDto {
    readonly level: ObservabilityEvidenceLevelUseCaseDto;
    readonly count: number;
}

export interface ObservabilityRuleAuditUseCaseDto {
    readonly total: number;
    readonly checks: number;
    readonly passes: number;
    readonly violations: number;
    readonly other: number;
}

export interface ObservabilityRuleEnforcementUseCaseDto {
    readonly warnings: number;
    readonly blocked: number;
    readonly approvalRequested: number;
    readonly approved: number;
    readonly rejected: number;
    readonly bypassed: number;
    readonly activeState: ObservabilityRuleStateUseCaseDto;
    readonly activeRuleId: string | undefined;
    readonly activeLabel: string | undefined;
}

export interface TaskObservabilityUseCaseDto {
    readonly taskId: string;
    readonly runtimeSource?: string;
    readonly totalDurationMs: number;
    readonly activeDurationMs: number;
    readonly totalEvents: number;
    readonly traceLinkCount: number;
    readonly traceLinkedEventCount: number;
    readonly traceLinkEligibleEventCount: number;
    readonly traceLinkCoverageRate: number;
    readonly phaseBreakdown: readonly ObservabilityPhaseStatUseCaseDto[];
    readonly sessions: {
        readonly total: number;
        readonly resumed: number;
        readonly open: number;
    };
    readonly signals: ObservabilityTaskSignalsUseCaseDto;
    readonly focus: ObservabilityTaskFocusUseCaseDto;
    readonly evidence: {
        readonly breakdown: readonly ObservabilityEvidenceCountUseCaseDto[];
    };
    readonly rules: ObservabilityRuleAuditUseCaseDto;
    readonly ruleEnforcement: ObservabilityRuleEnforcementUseCaseDto;
}

export interface MentionedExploredFileUseCaseDto {
    readonly path: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
}

export interface FileMentionVerificationUseCaseDto {
    readonly mentionType: "file";
    readonly path: string;
    readonly mentionedAt: string;
    readonly mentionedInEventId: string;
    readonly wasExplored: boolean;
    readonly firstExploredAt?: string;
    readonly explorationCount: number;
    readonly exploredAfterMention: boolean;
}

export interface DirectoryMentionVerificationUseCaseDto {
    readonly mentionType: "directory";
    readonly path: string;
    readonly mentionedAt: string;
    readonly mentionedInEventId: string;
    readonly exploredFilesInFolder: readonly MentionedExploredFileUseCaseDto[];
    readonly wasExplored: boolean;
    readonly exploredAfterMention: boolean;
}

export type MentionedFileVerificationUseCaseDto =
    | FileMentionVerificationUseCaseDto
    | DirectoryMentionVerificationUseCaseDto;

export interface GetTaskObservabilityUseCaseOut {
    readonly observability: TaskObservabilityUseCaseDto;
    readonly mentionedFileVerifications: readonly MentionedFileVerificationUseCaseDto[];
}
