import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLOCK, type ClockPort } from "~tracer-api/domain/rule/port/clock.port.js";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";

@Injectable()
export class DeleteRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly deleted: true }> {
        const rule = await this.rules.findById(id);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== userId) throw new NotFoundException("Rule not found");
        rule.softDelete(this.clock.now());
        await this.rules.upsert(rule);
        return { deleted: true };
    }
}
