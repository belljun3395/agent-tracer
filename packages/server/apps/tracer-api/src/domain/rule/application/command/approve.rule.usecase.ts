import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { RuleBackfillService } from "~tracer-api/domain/rule/application/rule.backfill.service.js";
import { mapRule, type RuleDto } from "~tracer-api/domain/rule/model/rule.model.js";

/** 승인 대기 규칙을 발효시킨다. */
@Injectable()
export class ApproveRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        private readonly backfill: RuleBackfillService,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly rule: RuleDto; readonly reevaluated: number }> {
        const rule = await this.rules.findById(id);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== userId || rule.isDeleted()) {
            throw new NotFoundException("Rule not found");
        }
        rule.approve();
        await this.rules.upsert(rule);
        const reevaluated = rule.taskId !== null ? await this.backfill.backfill(rule, rule.taskId) : 0;
        return { rule: mapRule(rule), reevaluated };
    }
}
