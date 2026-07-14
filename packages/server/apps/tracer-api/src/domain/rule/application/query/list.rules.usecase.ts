import { Inject, Injectable } from "@nestjs/common";
import type { RuleEntity, VerdictEntity } from "@monitor/tracer-domain";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import {
    RULE_VERDICT_REPOSITORY,
    type VerdictRepositoryPort,
} from "~tracer-api/domain/rule/port/verdict.repository.port.js";
import { mapRuleWithVerdict, type RuleDto } from "~tracer-api/domain/rule/model/rule.model.js";

/** 작업 문맥 없이 조회할 때 쓰는 sentinel 값이다. */
const NO_TASK = "";

@Injectable()
export class ListRulesUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        @Inject(RULE_VERDICT_REPOSITORY)
        private readonly verdicts: VerdictRepositoryPort,
    ) {}

    async execute(
        userId: string,
        opts: { taskId?: string; all?: boolean } = {},
    ): Promise<{ readonly items: readonly RuleDto[] }> {
        const rules = opts.all
            ? await this.rules.findAllByUser(userId)
            : await this.rules.findAllForListing(userId, opts.taskId ?? NO_TASK);
        return { items: await this.withVerdicts(rules) };
    }

    private async withVerdicts(rules: readonly RuleEntity[]): Promise<RuleDto[]> {
        const verdicts = await this.verdicts.findByRules(rules.map((rule) => rule.id));
        const byRule = new Map<string, VerdictEntity>(verdicts.map((verdict) => [verdict.ruleId, verdict]));
        return rules.map((rule) => mapRuleWithVerdict(rule, byRule.get(rule.id) ?? null));
    }
}
