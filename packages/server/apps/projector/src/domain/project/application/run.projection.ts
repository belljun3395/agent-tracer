import { Injectable } from "@nestjs/common";
import {
    KIND,
    NOTIFICATION_TYPE,
    type EventKind,
    type NotificationEnvelope,
} from "@monitor/kernel";
import { sessionNotification, taskNotification } from "~projector/support/notification.factory.js";
import type { RunProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { RunSessionProjection } from "~projector/domain/project/application/run.session.projection.js";
import { RunTaskProjection } from "~projector/domain/project/application/run.task.projection.js";

/** 실행 이벤트 종류에 맞는 세션·태스크 투영을 조율한다. */
@Injectable()
export class RunProjection {
    constructor(
        private readonly tasks: RunTaskProjection,
        private readonly sessions: RunSessionProjection,
    ) {}

    async project(
        repositories: RunProjectionRepositories,
        record: LedgerRecord,
    ): Promise<NotificationEnvelope[]> {
        const kind: EventKind = record.kind;
        if (kind === KIND.sessionStarted) return this.sessionStarted(repositories, record);
        if (kind === KIND.sessionEnded) return this.sessionEnded(repositories, record);
        const task = await this.tasks.project(repositories, record);
        return [taskNotification(NOTIFICATION_TYPE.taskUpdated, task)];
    }

    private async sessionStarted(
        repositories: RunProjectionRepositories,
        record: LedgerRecord,
    ): Promise<NotificationEnvelope[]> {
        const { task, taskCreated } = await this.sessions.projectStarted(repositories, record);
        const notifications: NotificationEnvelope[] = [];
        if (record.sessionId !== null) {
            notifications.push(sessionNotification(
                NOTIFICATION_TYPE.sessionStarted,
                record.userId,
                record.taskId,
                record.sessionId,
            ));
        }
        if (taskCreated) notifications.push(taskNotification(NOTIFICATION_TYPE.taskStarted, task));
        return notifications;
    }

    private async sessionEnded(
        repositories: RunProjectionRepositories,
        record: LedgerRecord,
    ): Promise<NotificationEnvelope[]> {
        await this.sessions.projectEnded(repositories, record);
        return [sessionNotification(
            NOTIFICATION_TYPE.sessionEnded,
            record.userId,
            record.taskId,
            record.sessionId ?? "",
        )];
    }
}
