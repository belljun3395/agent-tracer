import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { JobFeedback, JobFeedbackKind } from "@monitor/kernel";
import { JobFeedbackEntity } from "@monitor/tracer-domain";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { JOB_FEEDBACK_REPOSITORY, type JobFeedbackRepositoryPort } from "~tracer-api/domain/job/port/job.feedback.repository.port.js";

export interface SubmitJobFeedbackInput {
    readonly userId: string;
    readonly jobId: string;
    readonly targetId?: string;
    readonly kind: JobFeedbackKind;
    readonly ratingValue?: number;
    readonly editedContent?: Record<string, unknown>;
}

@Injectable()
export class SubmitJobFeedbackUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
        @Inject(JOB_FEEDBACK_REPOSITORY)
        private readonly feedback: JobFeedbackRepositoryPort,
    ) {}

    async execute(input: SubmitJobFeedbackInput): Promise<{ readonly feedback: JobFeedback }> {
        const job = await this.jobs.findById(input.jobId);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(input.userId)) throw new NotFoundException("Job not found");

        const feedback = JobFeedbackEntity.create({
            userId: input.userId,
            jobId: input.jobId,
            kind: input.kind,
            ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
            ...(input.ratingValue !== undefined ? { ratingValue: input.ratingValue } : {}),
            ...(input.editedContent !== undefined ? { editedContent: input.editedContent } : {}),
            now: new Date(),
        });
        await this.feedback.insert(feedback);
        return { feedback: mapJobFeedback(feedback) };
    }
}

function mapJobFeedback(feedback: JobFeedbackEntity): JobFeedback {
    return {
        jobId: feedback.jobId,
        kind: feedback.kind,
        ...(feedback.targetId !== null ? { targetId: feedback.targetId } : {}),
        ...(feedback.ratingValue !== null ? { ratingValue: feedback.ratingValue } : {}),
        ...(feedback.editedContent !== null ? { editedContent: feedback.editedContent } : {}),
        ts: feedback.ts.toISOString(),
    };
}
