import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_PUBLISHER_PORT, RULE_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import type { IRuleNotificationPublisher } from "./outbound/notification.publisher.port.js";
import { RuleNotFoundError } from "../common/errors.js";

/**
 * Soft delete: sets `deleted_at`. Verdicts and enforcements are preserved
 * as audit trail. The rule disappears from active list / evaluation but
 * past results remain referenced by deleted_at + name.
 */
@Injectable()
export class DeleteRuleUseCase {
    private readonly now: () => string = () => new Date().toISOString();

    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IRuleNotificationPublisher,
    ) {}

    async execute(id: string): Promise<void> {
        const current = await this.ruleRepo.findById(id);
        if (!current) throw new RuleNotFoundError(id);
        const ok = await this.ruleRepo.softDelete(id, this.now());
        if (!ok) throw new RuleNotFoundError(id);
        this.notifier.publish({
            type: "rules.changed",
            payload: {
                ruleId: id,
                change: "deleted",
                scope: current.scope,
                ...(current.taskId ? { taskId: current.taskId } : {}),
            },
        });
    }
}
