import { Injectable } from "@nestjs/common";
import { RuleBackfillService } from "../service/rule.backfill.service.js";

/** 단일 규칙 재평가(backfill) 작업을 enqueue한다. */
@Injectable()
export class EnqueueRuleBackfillUseCase {
    constructor(private readonly service: RuleBackfillService) {}

    async execute(ruleId: string) {
        const job = await this.service.run(ruleId);
        return {
            jobId: job.id,
            status: job.status,
            ruleId: job.ruleId,
            createdAt: job.createdAt,
        };
    }
}
