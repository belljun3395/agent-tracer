import { Injectable } from "@nestjs/common";
import {
    MONITORING_TASK_KIND,
    RUNNING_TASK_STATUS,
    TASK_ORIGINS,
    type TaskOrigin,
    type TaskStatus,
} from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { TaskEntity } from "@monitor/tracer-domain";
import type { RunProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

const DEFAULT_ORIGIN: TaskOrigin = TASK_ORIGINS[0];

export interface EnsuredTask {
    readonly task: TaskEntity;
    readonly created: boolean;
}

function slugify(title: string): string {
    const base = title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return base.length > 0 ? base : "task";
}

/** 실행 이벤트의 태스크 읽기 모델 생성과 상태 전이를 투영한다. */
@Injectable()
export class RunTaskProjection {
    async projectSessionStart(repositories: RunProjectionRepositories, record: LedgerRecord): Promise<EnsuredTask> {
        const ensured = await this.ensure(repositories, record);
        ensured.task.recordSessionStart(record.occurredAt);
        await repositories.tasks.upsert(ensured.task);
        return ensured;
    }

    async project(repositories: RunProjectionRepositories, record: LedgerRecord): Promise<TaskEntity> {
        const { task } = await this.ensure(repositories, record);
        await repositories.tasks.upsert(task);
        return task;
    }

    async projectTerminal(
        repositories: RunProjectionRepositories,
        record: LedgerRecord,
        status: TaskStatus,
    ): Promise<TaskEntity> {
        const { task } = await this.ensure(repositories, record);
        task.applyLedgerStatusEffect(status, record.occurredAt, record.seq);
        await repositories.tasks.upsert(task);
        return task;
    }

    private async ensure(repositories: RunProjectionRepositories, record: LedgerRecord): Promise<EnsuredTask> {
        const payload = parseStoredEventPayload(record.payload);
        const title = payload.title;
        const taskKind = payload.taskKind;
        const workspacePath = payload.workspacePath;
        const parentTaskId = payload.parentTaskId;
        const parentSessionId = payload.parentSessionId;
        const backgroundOfTaskId = payload.backgroundTaskId;
        const cliSource = payload.runtimeSource;

        const existing = await repositories.tasks.findById(record.taskId);
        if (existing !== null) {
            if (title !== undefined) {
                existing.title = title;
                existing.slug = slugify(title);
            }
            if (taskKind !== undefined) existing.taskKind = taskKind;
            if (workspacePath !== undefined) existing.workspacePath = workspacePath;
            if (parentTaskId !== undefined) existing.parentTaskId = parentTaskId;
            if (parentSessionId !== undefined) existing.parentSessionId = parentSessionId;
            if (backgroundOfTaskId !== undefined) existing.backgroundOfTaskId = backgroundOfTaskId;
            return { task: existing, created: false };
        }

        const task = new TaskEntity();
        task.id = record.taskId;
        task.userId = record.userId;
        task.title = title ?? record.taskId;
        task.slug = slugify(task.title);
        task.workspacePath = workspacePath ?? null;
        task.status = RUNNING_TASK_STATUS;
        task.taskKind = taskKind ?? MONITORING_TASK_KIND.primary;
        task.origin = payload.origin ?? DEFAULT_ORIGIN;
        task.cliSource = cliSource ?? null;
        task.parentTaskId = parentTaskId ?? null;
        task.parentSessionId = parentSessionId ?? null;
        task.backgroundOfTaskId = backgroundOfTaskId ?? null;
        task.createdAt = record.occurredAt;
        task.updatedAt = record.occurredAt;
        task.lastSessionStartedAt = null;
        task.lastEventAt = null;
        return { task, created: true };
    }
}
