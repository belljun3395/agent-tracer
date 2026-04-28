/**
 * Outbound port — enqueue a post-processing job for a logged event so the
 * heavy verification work runs out of the ingest critical path. Self-contained.
 */

export type PostProcessingJobType =
    | "verification.user_message"
    | "verification.assistant_response"
    | "verification.other_event";

export interface PostProcessingJobInput {
    readonly eventId: string;
    readonly jobType: PostProcessingJobType;
}

export interface IPostProcessingQueue {
    enqueue(job: PostProcessingJobInput): Promise<void>;
}
