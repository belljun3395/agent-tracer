import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { runOnTransactionCommit } from "typeorm-transactional";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { EVENT_RECORDED } from "@monitor/timeline-api/event/public/events/event.recorded.js";
import type { EventRecordedPayload } from "@monitor/timeline-api/event/public/events/event.recorded.js";
import { shouldApplyLoggedEventTaskStatusEffect } from "../domain/task.status.effect.js";
import { TaskQueryService } from "../service/task.query.service.js";
import { TaskManagementService } from "../service/task.management.service.js";
import { CLOCK_PORT, NOTIFICATION_PUBLISHER_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { ITaskNotificationPublisher } from "../application/outbound/notification.publisher.port.js";

/**
 * Applies a recorded event's task-status effect. Subscribes to timeline's
 * `event.recorded` (a downward dependency on timeline's public contract) so
 * timeline no longer commands work. Runs inside the recording transaction via
 * `emitAsync`; the taskUpdated notification is deferred to commit so a rollback
 * can't surface a phantom status change.
 */
@Injectable()
export class EventRecordedTaskEffectSubscriber {
    constructor(
        private readonly query: TaskQueryService,
        private readonly management: TaskManagementService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ITaskNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @OnEvent(EVENT_RECORDED, { suppressErrors: false })
    async onEventRecorded(payload: EventRecordedPayload): Promise<void> {
        const desiredStatus = payload.taskEffects?.taskStatus;
        if (desiredStatus === undefined) return;

        const task = await this.query.findById(payload.taskId);
        if (!task) return;
        if (!shouldApplyLoggedEventTaskStatusEffect({ currentStatus: task.status, desiredStatus })) return;

        const updated = await this.management.updateStatus(payload.taskId, desiredStatus, this.clock.nowIso());
        if (updated) {
            runOnTransactionCommit(() => {
                this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
            });
        }
    }
}
