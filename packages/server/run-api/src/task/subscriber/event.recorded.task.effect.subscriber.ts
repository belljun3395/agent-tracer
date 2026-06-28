import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { runOnTransactionCommit } from "typeorm-transactional";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { EVENT_RECORDED } from "@monitor/timeline-api/event/public/events/event.recorded.js";
import type { EventRecordedPayload } from "@monitor/timeline-api/event/public/events/event.recorded.js";
import { shouldApplyLoggedEventTaskStatusEffect } from "../domain/task.status.effect.policy.js";
import { TaskReadService } from "../service/task.read.service.js";
import { TaskManagementService } from "../service/task.management.service.js";
import { CLOCK_PORT, NOTIFICATION_PUBLISHER_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { ITaskNotificationPublisher } from "../application/outbound/notification.publisher.port.js";

@Injectable()
export class EventRecordedTaskEffectSubscriber {
    constructor(
        private readonly query: TaskReadService,
        private readonly management: TaskManagementService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ITaskNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @OnEvent(EVENT_RECORDED, { suppressErrors: false })
    async onEventRecorded(payload: EventRecordedPayload): Promise<void> {
        const desiredStatus = payload.taskEffects?.taskStatus;
        // 이벤트가 상태 효과를 선언하지 않으면 태스크 상태를 바꾸지 않는다.
        if (desiredStatus === undefined) return;

        const task = await this.query.findById(payload.taskId);
        if (!task) return;
        // 완료 태스크 보호와 중복 갱신 방지는 도메인 정책에 맡긴다.
        if (!shouldApplyLoggedEventTaskStatusEffect({ currentStatus: task.status, desiredStatus })) return;

        const updated = await this.management.updateStatus(payload.taskId, desiredStatus, this.clock.nowIso());
        if (updated) {
            // 트랜잭션이 커밋된 상태 변경만 대시보드에 알린다.
            runOnTransactionCommit(() => {
                this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
            });
        }
    }
}
