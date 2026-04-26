import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { KIND } from "~domain/monitoring/common/const/event.kind.const.js";
import { matchEventAgainstRule } from "~domain/verification/rule/event-rule.matching.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { RuleReadPort } from "~application/ports/rules/rule.read.port.js";
import type { RuleEnforcementInsertPortDto } from "~application/ports/verification/rule-enforcements/dto/rule.enforcement.insert.port.dto.js";
import type { RuleEnforcementWritePort } from "~application/ports/verification/rule-enforcements/rule.enforcement.write.port.js";
import type { TurnReadPort } from "~application/ports/verification/turns/turn.read.port.js";
import type { TurnWritePort } from "~application/ports/verification/turns/turn.write.port.js";

/**
 * Per-event matcher: when a new event arrives while a turn is open,
 * checks the event against active rules and writes rule_enforcements rows
 * for any matches. Each match is broadcast immediately as
 * `rule_enforcement.added` so the client can reclassify the event lane in
 * real time.
 *
 * Verdicts (the per-turn definitive result) are NOT computed here — that
 * happens at turn close in TurnLifecyclePostProcessor.
 */
export class RuleEnforcementPostProcessor {
    constructor(
        private readonly ruleRepo: RuleReadPort,
        private readonly turnRepo: TurnReadPort & TurnWritePort,
        private readonly enforcementRepo: RuleEnforcementWritePort,
        private readonly notifier: NotificationPublisherPort,
        private readonly now: () => string = () => new Date().toISOString(),
    ) {}

    async processLoggedEvent(event: TimelineEvent): Promise<void> {
        if (!event.sessionId) return;

        const turn = await this.turnRepo.findOpenBySessionId(event.sessionId);
        if (!turn) return;

        if (event.kind !== KIND.userMessage) {
            await this.turnRepo.linkEvents(turn.id, [event.id]);
        }

        const rules = await this.ruleRepo.findActiveForTurn(turn.taskId);
        if (rules.length === 0) return;

        const inserts: RuleEnforcementInsertPortDto[] = [];
        const decidedAt = this.now();

        for (const rule of rules) {
            const matchKinds = matchEventAgainstRule(event, rule);
            for (const matchKind of matchKinds) {
                inserts.push({ eventId: event.id, ruleId: rule.id, matchKind, decidedAt });
            }
        }

        if (inserts.length === 0) return;
        const inserted = await this.enforcementRepo.insertMany(inserts);

        for (const ins of inserted) {
            this.notifier.publish({
                type: "rule_enforcement.added",
                payload: {
                    eventId: ins.eventId,
                    ruleId: ins.ruleId,
                    matchKind: ins.matchKind,
                    taskId: event.taskId,
                    sessionId: event.sessionId,
                },
            });
        }
    }
}
