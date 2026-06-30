import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { CLOCK_PORT } from "./outbound/tokens.js";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { RuleNotificationPublisherAdapter } from "../../adapter/rule/notification.publisher.adapter.js";
import type { IClock } from "./outbound/clock.port.js";
import { RuleNotFoundError } from "../../domain/rule/errors.js";

@Injectable()
export class DeleteRuleUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
        private readonly notifier: RuleNotificationPublisherAdapter,
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
