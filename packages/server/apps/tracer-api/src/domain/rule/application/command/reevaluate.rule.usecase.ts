import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { RuleBackfillService } from "~tracer-api/domain/rule/application/rule.backfill.service.js";

export interface ReevaluateRuleInput {
    readonly taskId?: string;
}

@Injectable()
export class ReevaluateRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        private readonly backfill: RuleBackfillService,
    ) {}

    async execute(
        userId: string,
        ruleId: string,
        input: ReevaluateRuleInput = {},
    ): Promise<{ readonly reevaluated: number }> {
        const rule = await this.rules.findById(ruleId);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== userId) throw new NotFoundException("Rule not found");
        const taskId = rule.taskId ?? input.taskId;
        if (taskId === undefined) return { reevaluated: 0 };

        return { reevaluated: await this.backfill.backfill(rule, taskId) };
    }
}
