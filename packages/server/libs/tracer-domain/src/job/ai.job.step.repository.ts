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
}
