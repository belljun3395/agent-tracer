import { Inject, Injectable } from "@nestjs/common";
import type { RuleEntity } from "@monitor/tracer-domain";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { RULE_TURN_REPOSITORY, type TurnRepositoryPort } from "~tracer-api/domain/rule/port/turn.repository.port.js";
import {
    RULE_VERDICT_REPOSITORY,
    type VerdictRepositoryPort,
} from "~tracer-api/domain/rule/port/verdict.repository.port.js";
import { mapRule, type RuleDto } from "~tracer-api/domain/rule/model/rule.model.js";

/** 작업 문맥 없이 조회할 때 쓰는 sentinel 값이다. */
const NO_TASK = "";

@Injectable()
export class ListRulesUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        @Inject(RULE_TURN_REPOSITORY)
        private readonly turns: TurnRepositoryPort,
        @Inject(RULE_VERDICT_REPOSITORY)
        private readonly verdicts: VerdictRepositoryPort,
    ) {}

    async execute(
        userId: string,
        opts: { taskId?: string; all?: boolean } = {},
    ): Promise<{ readonly items: readonly RuleDto[] }> {
        if (opts.all) {
            const rules = await this.rules.findAllByUser(userId);
            return { items: rules.map(mapRule) };
        }
        const rules = await this.rules.findAllForListing(userId, opts.taskId ?? NO_TASK);
        if (opts.taskId === undefined) return { items: rules.map(mapRule) };

        const turnIds = (await this.turns.findByTask(opts.taskId)).map((t) => t.id);
        const items = await Promise.all(rules.map((rule) => this.withMatchCount(rule, turnIds)));
        return { items };
    }

    private async withMatchCount(rule: RuleEntity, turnIds: readonly string[]): Promise<RuleDto> {
        const verdicts = await this.verdicts.findByRuleAndTurns(rule.id, turnIds);
        const matchCount = new Set(verdicts.flatMap((v) => v.evidence.enforcements.map((e) => e.eventId))).size;
        return { ...mapRule(rule), matchCount };
    }
}
