import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    computeRuleSignature,
    type RuleSeverity,
} from "@monitor/kernel";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { mapRule, type RuleDto, type RuleExpectationInput } from "~tracer-api/domain/rule/model/rule.model.js";

export interface UpdateRuleInput {
    readonly userId: string;
    readonly id: string;
    readonly name?: string;
    readonly expectation?: RuleExpectationInput;
    readonly severity?: RuleSeverity;
    readonly rationale?: string | null;
}

@Injectable()
export class UpdateRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
    ) {}

    async execute(input: UpdateRuleInput): Promise<{ readonly rule: RuleDto }> {
        const rule = await this.rules.findById(input.id);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== input.userId) throw new NotFoundException("Rule not found");

        if (input.name !== undefined) rule.name = input.name;
        if (input.severity !== undefined) rule.severity = input.severity;
        if (input.rationale !== undefined) rule.rationale = input.rationale;
        if (input.expectation !== undefined) {
            rule.expectation = input.expectation;
            rule.signature = computeRuleSignature(rule.expectation);
        }
        rule.markEditedByUser();

        await this.rules.upsert(rule);
        return { rule: mapRule(rule) };
    }
}
