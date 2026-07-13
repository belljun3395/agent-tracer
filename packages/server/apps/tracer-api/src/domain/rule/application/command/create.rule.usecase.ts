import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import {
    RULE_SCOPE,
    RULE_SEVERITY,
    RULE_SOURCE,
    admitReviewState,
    computeRuleSignature,
    type RuleScope,
    type RuleSeverity,
    type RuleSource,
    type RuleTriggerSource,
} from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { mapRule, type RuleDto, type RuleExpectationInput } from "~tracer-api/domain/rule/model/rule.model.js";

export interface CreateRuleInput {
    readonly userId: string;
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[]; readonly on?: RuleTriggerSource };
    readonly expectation: RuleExpectationInput;
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly severity?: RuleSeverity;
    readonly rationale?: string;
    readonly source?: RuleSource;
    /** 판정 창의 시작점이 되는 근거 사용자 입력이다. */
    readonly anchorEventId?: string;
}

@Injectable()
export class CreateRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
    ) {}

    async execute(input: CreateRuleInput): Promise<{ readonly rule: RuleDto; readonly created: boolean }> {
        const now = new Date();
        const trigger = {
            phrases: input.trigger?.phrases ?? [],
            ...(input.trigger?.on !== undefined ? { on: input.trigger.on } : {}),
        };
        const expectation = input.expectation;
        const signature = computeRuleSignature(trigger, expectation);

        const existing = await this.rules.findApplicable(input.userId, input.taskId ?? "");
        const duplicate = existing.find((rule) => rule.signature === signature);
        if (duplicate !== undefined) return { rule: mapRule(duplicate), created: false };

        const rule = new RuleEntity();
        rule.id = generateUlid(now.getTime());
        rule.userId = input.userId;
        rule.name = input.name;
        rule.trigger = trigger;
        rule.expectation = expectation;
        rule.scope = input.scope;
        rule.taskId = input.scope === RULE_SCOPE.task ? input.taskId ?? null : null;
        rule.source = input.source ?? RULE_SOURCE.human;
        rule.severity = input.severity ?? RULE_SEVERITY.info;
        rule.reviewState = admitReviewState(rule.source, rule.severity);
        rule.rationale = input.rationale ?? null;
        rule.signature = signature;
        rule.sourceJobId = null;
        rule.anchorEventId = input.anchorEventId ?? null;
        rule.initializeProvenance(rule.source);
        rule.createdAt = now;
        rule.deletedAt = null;
        await this.rules.upsert(rule);
        return { rule: mapRule(rule), created: true };
    }
}
