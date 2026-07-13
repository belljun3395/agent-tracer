import { Inject, Injectable } from "@nestjs/common";
import { COMPLETED_TASK_STATUS, NOTIFICATION_TYPE, type NotificationEnvelope } from "@monitor/kernel";
import { taskNotification } from "~projector/support/notification.factory.js";
import { ADVISORY_LOCK_KEY } from "~projector/domain/recover/port/advisory.lock.keys.js";
import {
    ADVISORY_LOCK,
    type AdvisoryLockPort,
} from "~projector/domain/recover/port/advisory.lock.port.js";
import {
    NOTIFICATION_PUBLISHER,
    type NotificationPublisherPort,
} from "~projector/domain/recover/port/notification.publisher.port.js";
import type { TaskReaperRepositories } from "~projector/domain/recover/port/task.reaper.repository.port.js";
import { logError, logInfo } from "~projector/support/log.js";
import { recordReaperRecovered } from "~projector/support/metrics.js";

const REAP_BATCH = 200;

/** idle 임계값을 넘겨 고착된 자식 작업을 completed로 회수한다. */
@Injectable()
export class TaskReaperService {
    private timer: NodeJS.Timeout | null = null;

    constructor(
        @Inject(ADVISORY_LOCK) private readonly lock: AdvisoryLockPort<TaskReaperRepositories>,
        @Inject(NOTIFICATION_PUBLISHER) private readonly publisher: NotificationPublisherPort,
    ) {}

    start(intervalMs: number, idleMs: number): void {
        if (this.timer !== null) return;
        this.timer = setInterval(() => void this.runOnce(new Date(), idleMs), intervalMs);
        // 회수 타이머가 프로세스 종료를 막지 않게 한다.
        this.timer.unref();
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    async runOnce(now: Date, idleMs: number): Promise<number> {
        const before = new Date(now.getTime() - idleMs);
        try {
            const notifications = await this.lock.withAdvisoryLock(ADVISORY_LOCK_KEY.taskReaper, async (repositories) => {
                const stale = await repositories.tasks.findReapableChildren(before, REAP_BATCH);
                const out: NotificationEnvelope[] = [];
                for (const task of stale) {
                    if (!task.isReapableChild(now, idleMs)) continue;
                    if (task.forceStatus(COMPLETED_TASK_STATUS, now)) {
                        await repositories.tasks.upsert(task);
                        out.push(taskNotification(NOTIFICATION_TYPE.taskUpdated, task));
                    }
                }
                return out;
            });
            if (notifications === null || notifications.length === 0) return 0;
            for (const envelope of notifications) await this.publisher.publish(envelope);
            recordReaperRecovered(notifications.length);
            logInfo({ msg: "reaper.completed", count: notifications.length });
            return notifications.length;
        } catch (error) {
            logError({ msg: "reaper.error", error: error instanceof Error ? error.message : String(error) });
            return 0;
        }
    }
}
