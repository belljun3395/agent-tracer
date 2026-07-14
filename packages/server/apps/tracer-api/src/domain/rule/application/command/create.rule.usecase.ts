import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import {
    RULE_SEVERITY,
    RULE_SOURCE,
    admitReviewState,
    computeRuleSignature,
    type RuleSeverity,
    type RuleSource,
} from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/rule/port/clock.port.js";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { mapRule, type RuleDto, type RuleExpectationInput } from "~tracer-api/domain/rule/model/rule.model.js";

export interface CreateRuleInput {
    readonly userId: string;
    readonly name: string;
    readonly expectation: RuleExpectationInput;
    readonly taskId: string;
    /** 규칙을 낳은 사용자 입력이며 판정 창이 여기서 시작한다. */
    readonly anchorEventId: string;
    readonly severity?: RuleSeverity;
    readonly rationale?: string;
    readonly source?: RuleSource;
}

@Injectable()
export class CreateRuleUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: CreateRuleInput): Promise<{ readonly rule: RuleDto; readonly created: boolean }> {
        const now = this.clock.now();
        const signature = computeRuleSignature(input.expectation);

        const siblings = await this.rules.findByAnchor(input.userId, input.anchorEventId);
        const duplicate = siblings.find((rule) => rule.signature === signature);
        if (duplicate !== undefined) return { rule: mapRule(duplicate), created: false };

        const rule = new RuleEntity();
        rule.id = generateUlid(now.getTime());
        rule.userId = input.userId;
        rule.name = input.name;
        rule.expectation = input.expectation;
        rule.taskId = input.taskId;
        rule.anchorEventId = input.anchorEventId;
        rule.source = input.source ?? RULE_SOURCE.human;
        rule.severity = input.severity ?? RULE_SEVERITY.info;
        rule.reviewState = admitReviewState(rule.source, rule.severity);
        rule.rationale = input.rationale ?? null;
        rule.signature = signature;
        rule.sourceJobId = null;
        rule.initializeProvenance(rule.source);
        rule.createdAt = now;
        rule.deletedAt = null;
        await this.rules.upsert(rule);
        return { rule: mapRule(rule), created: true };
    }
}
