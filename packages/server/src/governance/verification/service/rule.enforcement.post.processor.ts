import type { TimelineEvent } from "~activity/event/public/types/event.types.js";
import { KIND } from "~activity/event/public/types/event.const.js";
import { matchEventAgainstRule } from "~governance/verification/domain/event-rule.matching.js";
import type { NotificationPublisherPort } from "~adapters/notifications/notification.publisher.port.js";
import type { IRuleAccess } from "~governance/verification/application/outbound/rule.access.port.js";
import type {
    IRuleEnforcementRepository,
    RuleEnforcementInsert,
} from "~governance/verification/application/outbound/rule.enforcement.repository.port.js";
import type { ITurnRepository } from "~governance/verification/application/outbound/turn.repository.port.js";




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
        private readonly ruleRepo: IRuleAccess,
        private readonly turnRepo: ITurnRepository,
        private readonly enforcementRepo: IRuleEnforcementRepository,
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

        const inserts: RuleEnforcementInsert[] = [];
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
