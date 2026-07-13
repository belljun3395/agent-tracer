import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { JOB_FEEDBACK_KIND, type JobFeedbackKind } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { InvariantViolationError } from "@monitor/tracer-domain/error/invariant.error.js";

export interface JobFeedbackCreateInput {
    readonly userId: string;
    readonly jobId: string;
    readonly targetId?: string;
    readonly kind: JobFeedbackKind;
    readonly ratingValue?: number;
    readonly editedContent?: Record<string, unknown>;
    readonly now: Date;
}

@Entity({ name: "job_feedback" })
@Index("job_feedback_job_ts", ["jobId", "ts"])
@Index("job_feedback_user_ts", ["userId", "ts"])
export class JobFeedbackEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "target_id", type: "text", nullable: true })
    targetId!: string | null;

    @Column({ type: "text" })
    kind!: JobFeedbackKind;

    @Column({ name: "rating_value", type: "integer", nullable: true })
    ratingValue!: number | null;

    @Column({ name: "edited_content", type: "jsonb", nullable: true })
    editedContent!: Record<string, unknown> | null;

    @Column({ type: "timestamptz" })
    ts!: Date;

    static create(input: JobFeedbackCreateInput): JobFeedbackEntity {
        const feedback = new JobFeedbackEntity();
        feedback.id = generateUlid(input.now.getTime());
        feedback.userId = input.userId;
        feedback.jobId = input.jobId;
        feedback.targetId = input.targetId ?? null;
        feedback.kind = input.kind;
        feedback.ratingValue = normalizeRating(input);
        feedback.editedContent = normalizeEditedContent(input);
        feedback.ts = input.now;
        return feedback;
    }
}

function normalizeRating(input: JobFeedbackCreateInput): number | null {
    if (input.kind !== JOB_FEEDBACK_KIND.rating) {
        if (input.ratingValue !== undefined) throw new InvariantViolationError("job-feedback.rating-kind");
        return null;
    }
    if (input.ratingValue === undefined || !Number.isInteger(input.ratingValue) || input.ratingValue < 1 || input.ratingValue > 5) {
        throw new InvariantViolationError("job-feedback.rating-range");
    }
    return input.ratingValue;
}

function normalizeEditedContent(input: JobFeedbackCreateInput): Record<string, unknown> | null {
    if (input.kind !== JOB_FEEDBACK_KIND.edit) {
        if (input.editedContent !== undefined) throw new InvariantViolationError("job-feedback.edit-kind");
        return null;
    }
    if (input.editedContent === undefined || Object.keys(input.editedContent).length === 0) {
        throw new InvariantViolationError("job-feedback.empty-edit");
    }
    return input.editedContent;
}
