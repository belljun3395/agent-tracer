import type { Repository } from "typeorm";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import type { JobFeedbackEntity } from "./job.feedback.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class JobFeedbackRepository {
    constructor(private readonly repo: Repository<JobFeedbackEntity>) {}

    async insert(feedback: JobFeedbackEntity): Promise<void> {
        await upsertByKeys(this.repo, feedback, ["id"]);
    }

    async findByJob(userId: string, jobId: string): Promise<JobFeedbackEntity[]> {
        return this.repo.find({ where: { userId, jobId }, order: { ts: "ASC" } });
    }

    async findByUser(userId: string, limit: number): Promise<JobFeedbackEntity[]> {
        return this.repo.find({
            where: { userId },
            order: { ts: "DESC" },
            take: limit,
        });
    }

    async findAccepted(userId: string, limit: number): Promise<JobFeedbackEntity[]> {
        return this.repo.find({
            where: { userId, kind: JOB_FEEDBACK_KIND.accept },
            order: { ts: "DESC" },
            take: limit,
        });
    }
}
