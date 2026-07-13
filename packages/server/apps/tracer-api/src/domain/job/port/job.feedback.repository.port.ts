import type { JobFeedbackEntity } from "@monitor/tracer-domain";

export const JOB_FEEDBACK_REPOSITORY = Symbol("JobFeedbackRepository");

/** 잡 결과에 대한 사용자 피드백을 저장하는 애플리케이션 포트다. */
export interface JobFeedbackRepositoryPort {
    insert(feedback: JobFeedbackEntity): Promise<void>;
}
