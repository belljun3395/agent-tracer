import type { MentionedFileVerification } from "~domain/monitoring/index.js";
import type { TaskObservabilitySummary } from "../projection/observability.metrics.type.js";

export interface GetTaskObservabilityUseCaseIn {
    readonly taskId: string;
}

export type TaskObservabilityUseCaseDto = TaskObservabilitySummary;
export type MentionedFileVerificationUseCaseDto = MentionedFileVerification;

export interface GetTaskObservabilityUseCaseOut {
    readonly observability: TaskObservabilityUseCaseDto;
    readonly mentionedFileVerifications: readonly MentionedFileVerificationUseCaseDto[];
}
