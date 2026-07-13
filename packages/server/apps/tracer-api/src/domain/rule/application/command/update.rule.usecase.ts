import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    RULE_SCOPE,
    computeRuleSignature,
    type RuleScope,
    type RuleSeverity,
    type RuleTriggerSource,
} from "@monitor/kernel";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { mapRule, type RuleDto, type RuleExpectationInput } from "~tracer-api/domain/rule/model/rule.model.js";

export interface UpdateRuleInput {
    readonly userId: string;
    readonly id: string;
    readonly name?: string;
    readonly trigger?: { readonly phrases: readonly string[]; readonly on?: RuleTriggerSource };
    readonly expectation?: RuleExpectationInput;
    readonly scope?: RuleScope;
    readonly taskId?: string;
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

        if (input.scope === RULE_SCOPE.global) {
            rule.promote();
        } else if (input.scope === RULE_SCOPE.task) {
            if (input.taskId === undefined) throw new BadRequestException("task scope requires taskId");
            rule.demote(input.taskId);
        }

        if (input.name !== undefined) rule.name = input.name;
        if (input.severity !== undefined) rule.severity = input.severity;
        if (input.rationale !== undefined) rule.rationale = input.rationale;
        if (input.trigger !== undefined) {
            rule.trigger = {
                phrases: input.trigger.phrases,
                ...(input.trigger.on !== undefined ? { on: input.trigger.on } : {}),
            };
        }
        if (input.expectation !== undefined) {
            rule.expectation = input.expectation;
        }
        if (input.trigger !== undefined || input.expectation !== undefined) {
            rule.signature = computeRuleSignature(rule.trigger, rule.expectation);
        }
        rule.markEditedByUser();

        await this.rules.upsert(rule);
        return { rule: mapRule(rule) };
    }
}
