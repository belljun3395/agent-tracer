import { aggregateVerdictStatus } from "@monitor/kernel";
import type { EventRepository } from "../timeline/event/event.repository.js";
import type { TurnEntity } from "../timeline/turn/turn.entity.js";
import type { TurnRepository } from "../timeline/turn/turn.repository.js";
import type { RuleEntity } from "./rule.entity.js";
import { RuleVerification } from "./verification/rule.verification.domain.js";
import type { VerdictEntity } from "./verification/verdict.entity.js";
import type { VerdictRepository } from "./verification/verdict.repository.js";

/** 규칙 판정이 읽고 쓰는 저장소 표면이다. */
export interface RuleEvaluationPorts {
    readonly events: Pick<EventRepository, "findByTaskSinceEvent" | "maxSeqSinceEvent">;
    readonly turns: Pick<TurnRepository, "upsert">;
    readonly verdicts: Pick<VerdictRepository, "findByRule" | "findByTurn" | "upsert">;
}

/** 규칙 하나의 판정을 이 턴까지의 창으로 전진시킨다. */
export class RuleEvaluator {
    constructor(private readonly ports: RuleEvaluationPorts) {}

    async evaluate(rule: RuleEntity, turn: TurnEntity, now: Date): Promise<TurnEntity | null> {
        const current = await this.ports.verdicts.findByRule(rule.id);
        // 종결된 판정은 다시 열리지 않으므로 창을 아예 읽지 않는다.
        if (current !== null && !current.isOpen()) return null;
        if ((await this.skipsUnchanged(rule, turn, current)) === true) return null;

        const windowEvents = await this.ports.events.findByTaskSinceEvent(turn.taskId, rule.anchorEventId);
        const verification = new RuleVerification(rule, windowEvents);
        if (!verification.covers()) return null;

        const verdict = verification.advance(current, turn.id, now);
        if (verdict === null) return null;

        const maxSeq = windowEvents[windowEvents.length - 1]?.seq;
        if (maxSeq !== undefined) verdict.markEvaluatedSeq(maxSeq);
        await this.ports.verdicts.upsert(verdict);
        await this.recordSummary(turn);
        return turn;
    }

    // 열린 판정이 마지막으로 본 창 끝 뒤로 새 이벤트가 없으면 창을 다시 읽어도 판정이 그대로다.
    private async skipsUnchanged(rule: RuleEntity, turn: TurnEntity, current: VerdictEntity | null): Promise<boolean> {
        if (current === null || current.lastEvaluatedSeq === null) return false;
        const maxSeq = await this.ports.events.maxSeqSinceEvent(turn.taskId, rule.anchorEventId);
        return maxSeq !== null && current.hasSeenThrough(maxSeq);
    }

    private async recordSummary(turn: TurnEntity): Promise<void> {
        const turnVerdicts = await this.ports.verdicts.findByTurn(turn.id);
        turn.recordVerdictSummary(aggregateVerdictStatus(turnVerdicts), turnVerdicts.length);
        await this.ports.turns.upsert(turn);
    }
}
