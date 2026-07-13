import type { JobFeedbackEntity } from "@monitor/tracer-domain";
import type { JobFeedbackRepositoryPort } from "~tracer-api/domain/job/port/job.feedback.repository.port.js";

/** 피드백 저장소 포트의 인메모리 대역이다. */
export class InMemoryJobFeedbackRepository implements JobFeedbackRepositoryPort {
    private readonly rows = new Map<string, JobFeedbackEntity>();

    seed(...feedback: readonly JobFeedbackEntity[]): void {
        for (const row of feedback) this.rows.set(row.id, row);
    }

    all(): readonly JobFeedbackEntity[] {
        return [...this.rows.values()];
    }

    insert(feedback: JobFeedbackEntity): Promise<void> {
        this.rows.set(feedback.id, feedback);
        return Promise.resolve();
    }
}
