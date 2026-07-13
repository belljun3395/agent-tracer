import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";

@Injectable()
export class DeleteRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly deleted: true }> {
        const rule = await this.rules.findById(id);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== userId) throw new NotFoundException("Rule not found");
        rule.softDelete(new Date());
        await this.rules.upsert(rule);
        return { deleted: true };
    }
}
