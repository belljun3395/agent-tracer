import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { CLOCK_PORT, NOTIFICATION_PUBLISHER_PORT, RULE_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import type { IRuleNotificationPublisher } from "./outbound/notification.publisher.port.js";
import { RuleNotFoundError } from "../common/errors.js";

@Injectable()
export class DeleteRuleUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IRuleNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @Transactional()
    async execute(id: string): Promise<void> {
        const current = await this.ruleRepo.findById(id);
        if (!current) throw new RuleNotFoundError(id);
        const ok = await this.ruleRepo.softDelete(id, this.clock.nowIso());
        if (!ok) throw new RuleNotFoundError(id);
        this.notifier.publish({
            type: NOTIFICATION_TYPE.rulesChanged,
            payload: {
                ruleId: id,
                change: "deleted",
                scope: current.scope,
                ...(current.taskId ? { taskId: current.taskId } : {}),
            },
        });
    }
}
