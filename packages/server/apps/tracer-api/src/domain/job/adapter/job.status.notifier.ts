import { Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/kernel";
import type { JobStatusChange, JobStatusNotifier } from "~tracer-api/domain/job/port/job.status.notifier.port.js";
import { NotificationBroadcaster } from "~tracer-api/config/notification.broadcaster.js";

/** tracer-api가 직접 일으킨 잡 상태 전이를 Kafka를 거치지 않고 접속 소켓으로 전파하는 어댑터다. */
@Injectable()
export class WsJobStatusNotifier implements JobStatusNotifier {
    constructor(private readonly broadcaster: NotificationBroadcaster) {}

    notify(userId: string, change: JobStatusChange): void {
        this.broadcaster.fanout(userId, {
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                jobId: change.jobId,
                kind: change.kind,
                status: change.status,
                ...(change.taskId !== undefined ? { taskId: change.taskId } : {}),
            },
        });
    }
}
