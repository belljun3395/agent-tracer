import { Injectable } from "@nestjs/common";
import {
    COMPLETED_TASK_STATUS,
    ERRORED_TASK_STATUS,
    KIND,
    NOTIFICATION_TYPE,
    type EventKind,
    type NotificationEnvelope,
} from "@monitor/kernel";
import { sessionNotification, taskNotification } from "~projector/support/notification.factory.js";
import type { RunEventProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { RunSessionProjection } from "~projector/domain/project/application/run.session.projection.js";
import { RunTaskProjection } from "~projector/domain/project/application/run.task.projection.js";
import { RecipeProjection } from "./recipe.projection.js";

/** 실행 이벤트 종류에 맞는 세션·태스크 투영과 후속 레시피 해소를 조율한다. */
@Injectable()
export class RunProjection {
    constructor(
        private readonly tasks: RunTaskProjection,
        private readonly sessions: RunSessionProjection,
        private readonly recipes: RecipeProjection,
    ) {}

    async project(
        repositories: RunEventProjectionRepositories,
        record: LedgerRecord,
    ): Promise<NotificationEnvelope[]> {
        const kind: EventKind = record.kind;
        if (kind === KIND.sessionStarted) return this.sessionStarted(repositories, record);
        if (kind === KIND.sessionEnded) return this.sessionEnded(repositories, record);
        if (kind === KIND.taskStart) {
            const task = await this.tasks.project(repositories, record);
            return [taskNotification(NOTIFICATION_TYPE.taskStarted, task)];
        }
        if (kind === KIND.taskLinked) {
            const task = await this.tasks.project(repositories, record);
            return [taskNotification(NOTIFICATION_TYPE.taskUpdated, task)];
        }
        if (kind === KIND.taskComplete) {
            const task = await this.tasks.projectTerminal(repositories, record, COMPLETED_TASK_STATUS);
            await this.recipes.resolveForTask(repositories, record.taskId, COMPLETED_TASK_STATUS, record.occurredAt);
            return [taskNotification(NOTIFICATION_TYPE.taskCompleted, task)];
        }
        const task = await this.tasks.projectTerminal(repositories, record, ERRORED_TASK_STATUS);
        await this.recipes.resolveForTask(repositories, record.taskId, ERRORED_TASK_STATUS, record.occurredAt);
        return [taskNotification(NOTIFICATION_TYPE.taskUpdated, task)];
    }

    private async sessionStarted(
        repositories: RunEventProjectionRepositories,
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
        repositories: RunEventProjectionRepositories,
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
