import { aggregateVerdictStatus } from "@monitor/kernel";
import type { EventRepository } from "../timeline/event/event.repository.js";
import type { TurnEntity } from "../timeline/turn/turn.entity.js";
import type { TurnRepository } from "../timeline/turn/turn.repository.js";
import type { RuleEntity } from "./rule.entity.js";
import { RuleVerification } from "./verification/rule.verification.domain.js";
import type { VerdictRepository } from "./verification/verdict.repository.js";

/** 규칙 판정이 읽고 쓰는 저장소 표면이다. */
export interface RuleEvaluationPorts {
    readonly events: Pick<EventRepository, "findByTaskSinceEvent">;
    readonly turns: Pick<TurnRepository, "upsert">;
    readonly verdicts: Pick<VerdictRepository, "findByRule" | "findByTurn" | "upsert">;
}

/** 규칙 하나의 판정을 이 턴까지의 창으로 전진시킨다. */
export class RuleEvaluator {
    constructor(private readonly ports: RuleEvaluationPorts) {}

    async evaluate(rule: RuleEntity, turn: TurnEntity, now: Date): Promise<TurnEntity | null> {
        const windowEvents = await this.ports.events.findByTaskSinceEvent(turn.taskId, rule.anchorEventId);
        const verification = new RuleVerification(rule, windowEvents);
        if (!verification.covers()) return null;

        const current = await this.ports.verdicts.findByRule(rule.id);
        const verdict = verification.advance(current, turn.id, now);
        if (verdict === null) return null;

        await this.ports.verdicts.upsert(verdict);
        await this.recordSummary(turn);
        return turn;
    }

    private async recordSummary(turn: TurnEntity): Promise<void> {
        const turnVerdicts = await this.ports.verdicts.findByTurn(turn.id);
        turn.recordVerdictSummary(aggregateVerdictStatus(turnVerdicts), turnVerdicts.length);
        await this.ports.turns.upsert(turn);
    }
}
