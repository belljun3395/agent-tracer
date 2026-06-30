import { Injectable } from "@nestjs/common";
import { RuleJobRepository } from "../../repository/job/rule.job.repository.js";

@Injectable()
export class GetPendingRuleGenerationUseCase {
    constructor(private readonly jobs: RuleJobRepository) {}

    async execute() {
        const pending = await this.jobs.findPendingByType("rule_generation");
        return {
            jobs: pending.map((j) => ({
                jobId: j.id,
                taskId: j.taskId,
                createdAt: j.createdAt,
            })),
        };
    }
}
