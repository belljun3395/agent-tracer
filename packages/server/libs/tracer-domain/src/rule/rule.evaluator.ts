import { aggregateVerdictStatus } from "@monitor/kernel";
import type { EventEntity } from "../timeline/event/event.entity.js";
import type { EventRepository } from "../timeline/event/event.repository.js";
import type { TurnEntity } from "../timeline/turn/turn.entity.js";
import type { TurnRepository } from "../timeline/turn/turn.repository.js";
import type { RuleEntity } from "./rule.entity.js";
import { RuleVerification } from "./verification/rule.verification.domain.js";
import type { VerdictEntity } from "./verification/verdict.entity.js";
import type { VerdictRepository } from "./verification/verdict.repository.js";

/** 규칙 판정이 읽고 쓰는 저장소 표면이다. */
export interface RuleEvaluationPorts {
    readonly events: Pick<EventRepository, "findByTurn" | "findByTaskSinceEvent">;
    readonly turns: Pick<TurnRepository, "findById" | "upsert">;
    readonly verdicts: Pick<VerdictRepository, "findByTurn" | "upsert">;
}

/** 규칙 하나를 판정해 해당 턴에 기록한다. */
export class RuleEvaluator {
    constructor(private readonly ports: RuleEvaluationPorts) {}

    async evaluate(rule: RuleEntity, turn: TurnEntity, now: Date): Promise<TurnEntity | null> {
        const target = await this.resolveTarget(rule, turn);
        if (target === null) return null;

        const verdict = new RuleVerification(rule, target.turn, target.windowEvents).verdict(now);
        if (verdict === null) return null;
        await this.ports.verdicts.upsert(verdict);
        return this.recordSummary(target.turn, verdict);
    }

    private async resolveTarget(
        rule: RuleEntity,
        turn: TurnEntity,
    ): Promise<{ readonly turn: TurnEntity; readonly windowEvents: readonly EventEntity[] } | null> {
        const windowEvents = await this.ports.events.findByTaskSinceEvent(turn.taskId, rule.anchorEventId);
        const anchor = windowEvents[0];
        if (anchor === undefined || anchor.id !== rule.anchorEventId) return null;

        const anchorTurn = await this.resolveAnchorTurn(anchor, turn);
        if (anchorTurn === null) return null;
        return { turn: anchorTurn, windowEvents };
    }

    private async resolveAnchorTurn(anchor: EventEntity, turn: TurnEntity): Promise<TurnEntity | null> {
        if (anchor.turnId === null || anchor.turnId === turn.id) return turn;
        return this.ports.turns.findById(anchor.turnId);
    }

    private async recordSummary(turn: TurnEntity, verdict: VerdictEntity): Promise<TurnEntity | null> {
        const turnVerdicts = await this.ports.verdicts.findByTurn(turn.id);
        const statuses = turnVerdicts.length > 0 ? turnVerdicts.map((v) => v.status) : [verdict.status];
        const aggregate = aggregateVerdictStatus(statuses);
        if (aggregate === null) return null;
        turn.recordVerdictSummary(aggregate, statuses.length);
        await this.ports.turns.upsert(turn);
        return turn;
    }
}
