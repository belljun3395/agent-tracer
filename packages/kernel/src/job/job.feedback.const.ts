export const JOB_FEEDBACK_KIND = {
    accept: "accept",
    reject: "reject",
    edit: "edit",
    rating: "rating",
} as const;

export type JobFeedbackKind = (typeof JOB_FEEDBACK_KIND)[keyof typeof JOB_FEEDBACK_KIND];

export const JOB_FEEDBACK_KINDS = [
    JOB_FEEDBACK_KIND.accept,
    JOB_FEEDBACK_KIND.reject,
    JOB_FEEDBACK_KIND.edit,
    JOB_FEEDBACK_KIND.rating,
] as const satisfies readonly JobFeedbackKind[];

export interface JobFeedback {
    readonly jobId: string;
    /** 잡이 만든 산출물 중 평가 대상 하나(예: 규칙 id). 잡 전체 평가면 없다. */
    readonly targetId?: string;
    readonly kind: JobFeedbackKind;
    readonly ratingValue?: number;
    readonly editedContent?: Record<string, unknown>;
    readonly ts: string;
}
