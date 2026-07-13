import { Inject, Injectable } from "@nestjs/common";
import { RuleEvaluator, type RuleEntity } from "@monitor/tracer-domain";
import { RULE_EVENT_READER, type EventReaderPort } from "~tracer-api/domain/rule/port/event.reader.port.js";
import { RULE_TURN_REPOSITORY, type TurnRepositoryPort } from "~tracer-api/domain/rule/port/turn.repository.port.js";
import {
    RULE_VERDICT_REPOSITORY,
    type VerdictRepositoryPort,
} from "~tracer-api/domain/rule/port/verdict.repository.port.js";

/** 발효된 규칙을 이미 지나간 턴들에 소급 적용한다. */
@Injectable()
export class RuleBackfillService {
    constructor(
        @Inject(RULE_TURN_REPOSITORY)
        private readonly turns: TurnRepositoryPort,
        @Inject(RULE_EVENT_READER)
        private readonly events: EventReaderPort,
        @Inject(RULE_VERDICT_REPOSITORY)
        private readonly verdicts: VerdictRepositoryPort,
    ) {}

    async backfill(rule: RuleEntity, taskId: string, now: Date = new Date()): Promise<number> {
        if (!rule.isActive()) return 0;

        const evaluator = new RuleEvaluator({
            events: this.events,
            turns: this.turns,
            verdicts: this.verdicts,
        });
        const turns = await this.turns.findByTask(taskId);
        const evaluated = new Set<string>();
        for (const turn of turns) {
            const target = await evaluator.evaluate(rule, turn, now);
            if (target !== null) evaluated.add(target.id);
            if (rule.isAnchored() && evaluated.size > 0) break;
        }
        return evaluated.size;
    }
}
