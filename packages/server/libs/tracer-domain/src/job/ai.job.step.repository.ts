import type { Repository } from "typeorm";
import type { AiJobStepEntity } from "./ai.job.step.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class AiJobStepRepository {
    constructor(private readonly repo: Repository<AiJobStepEntity>) {}

    // finalize 재시도로 같은 (jobId, attempt, seq) 스텝이 다시 오면 upsert가 흡수한다.
    async insertMany(steps: readonly AiJobStepEntity[]): Promise<void> {
        if (steps.length === 0) return;
        await upsertByKeys(this.repo, [...steps], ["id"]);
    }

    async findByJobId(jobId: string, userId: string): Promise<AiJobStepEntity[]> {
        return this.repo.find({ where: { jobId, userId }, order: { attempt: "ASC", seq: "ASC" } });
    }

    // 보존 기간이 지난 스텝을 배치 상한 안에서 지우며, Postgres DELETE가 LIMIT을 지원하지 않아 서브쿼리로 대상을 좁힌다.
    async deleteOlderThan(cutoff: Date, limit: number): Promise<number> {
        const deleted = await this.repo.query<{ id: string }[]>(
            `DELETE FROM ai_job_steps WHERE id IN (
                SELECT id FROM ai_job_steps WHERE created_at < $1 ORDER BY created_at ASC LIMIT $2
            ) RETURNING id`,
            [cutoff, limit],
        );
        return deleted.length;
    }
}
