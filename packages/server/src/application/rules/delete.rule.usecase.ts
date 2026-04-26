import type { NotificationPublisherPort, RuleReadPort, RuleWritePort } from "~application/ports/index.js";
import { RuleNotFoundError } from "./common/errors.js";

/**
 * Soft delete: sets `deleted_at`. Verdicts and enforcements are preserved
 * as audit trail. The rule disappears from active list / evaluation but
 * past results remain referenced by deleted_at + name.
 */
export class DeleteRuleUseCase {
    constructor(
        private readonly ruleRepo: RuleReadPort & RuleWritePort,
        private readonly notifier: NotificationPublisherPort,
        private readonly now: () => string = () => new Date().toISOString(),
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
