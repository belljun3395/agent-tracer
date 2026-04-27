import { Inject, Injectable } from "@nestjs/common";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";
import type { TaskStatus, MonitoringTaskKind } from "~domain/monitoring/common/type/task.status.type.js";
import { TaskNotFoundError } from "../common/task.errors.js";
import { createTaskSlug } from "../common/task.slug.js";
import { TERMINAL_TASK_STATUSES } from "../common/task.status.js";
import { TaskEntity } from "../domain/task.entity.js";
import { TaskRelations } from "../domain/task.relations.model.js";
import { TaskRepository } from "../repository/task.repository.js";
import { TaskRelationRepository } from "../repository/task.relation.repository.js";
import { TaskQueryService } from "./task.query.service.js";
import { NOTIFICATION_PUBLISHER_PORT } from "../application/outbound/tokens.js";
import type { ITaskNotificationPublisher } from "../application/outbound/notification.publisher.port.js";

export interface TaskUpdateInput {
    readonly taskId: string;
    readonly title?: string;
    readonly status?: TaskStatus;
}

export interface TaskLinkInput {
    readonly taskId: string;
    readonly title?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

@Injectable()
export class TaskManagementService {
    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly relationRepo: TaskRelationRepository,
        private readonly query: TaskQueryService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ITaskNotificationPublisher,
    ) {}

    async update(input: TaskUpdateInput): Promise<MonitoringTask | null> {
        const task = await this.query.findById(input.taskId);
        if (!task) return null;

        const titleUpdate = input.title !== undefined ? input.title.trim() : undefined;
        const hasNewTitle = titleUpdate !== undefined && titleUpdate !== task.title;
        const hasNewStatus = input.status !== undefined && input.status !== task.status;
        if (!hasNewTitle && !hasNewStatus) return task;

        const entity = await this.taskRepo.findById(input.taskId);
        if (!entity) return null;
        if (hasNewTitle) {
            entity.title = titleUpdate;
            entity.slug = createTaskSlug({ title: titleUpdate });
        }
        if (hasNewStatus) {
            entity.status = input.status;
        }
        entity.updatedAt = new Date().toISOString();
        await this.taskRepo.save(entity);

        const updated = await this.query.findById(input.taskId);
        if (updated) {
            this.notifier.publish({ type: "task.updated", payload: updated });
        }
        return updated;
    }

    async link(input: TaskLinkInput): Promise<MonitoringTask> {
        const entity = await this.taskRepo.findById(input.taskId);
        if (!entity) throw new TaskNotFoundError(input.taskId);

        const titleTrimmed = input.title?.trim();
        if (titleTrimmed) {
            entity.title = titleTrimmed;
            entity.slug = createTaskSlug({ title: titleTrimmed });
        }
        if (input.taskKind) {
            entity.taskKind = input.taskKind;
        }
        entity.updatedAt = new Date().toISOString();
        await this.taskRepo.save(entity);

        await this.syncRelations(input.taskId, {
            ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId !== undefined ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId !== undefined ? { backgroundTaskId: input.backgroundTaskId } : {}),
        });

        const updated = await this.query.findById(input.taskId);
        if (!updated) throw new TaskNotFoundError(input.taskId);
        this.notifier.publish({ type: "task.updated", payload: updated });
        return updated;
    }

    async delete(taskId: string): Promise<{ status: "deleted"; deletedIds: readonly string[] } | { status: "not_found" }> {
        const exists = await this.taskRepo.findById(taskId);
        if (!exists) return { status: "not_found" };

        const descendants = await this.taskRepo.collectDescendantIds(taskId);
        const allIds = [taskId, ...descendants];
        await this.taskRepo.deleteByIds(allIds);

        for (const id of allIds) {
            this.notifier.publish({ type: "task.deleted", payload: { taskId: id } });
        }
        return { status: "deleted", deletedIds: allIds };
    }

    async deleteFinished(): Promise<{ count: number }> {
        const finishedIds = await this.taskRepo.listIdsByStatuses(TERMINAL_TASK_STATUSES);
        if (finishedIds.length === 0) return { count: 0 };

        const all = new Set<string>();
        for (const id of finishedIds) {
            all.add(id);
            for (const desc of await this.taskRepo.collectDescendantIds(id)) {
                all.add(desc);
            }
        }
        await this.taskRepo.deleteByIds([...all]);
        const count = all.size;
        this.notifier.publish({ type: "tasks.purged", payload: { count } });
        return { count };
    }

    /** Internal upsert used by lifecycle service. Updates entity + relations + emits task.updated when applicable. */
    async upsertFromDraft(input: {
        readonly id: string;
        readonly title: string;
        readonly slug: string;
        readonly status: TaskStatus;
        readonly taskKind: MonitoringTaskKind;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly lastSessionStartedAt: string;
        readonly workspacePath?: string;
        readonly runtimeSource?: string;
        readonly parentTaskId?: string;
        readonly parentSessionId?: string;
        readonly backgroundTaskId?: string;
    }): Promise<MonitoringTask> {
        const existing = await this.taskRepo.findById(input.id);
        const entity = existing ?? new TaskEntity();
        entity.id = input.id;
        entity.title = input.title;
        entity.slug = input.slug;
        entity.status = input.status;
        entity.taskKind = input.taskKind;
        entity.createdAt = existing?.createdAt ?? input.createdAt;
        entity.updatedAt = input.updatedAt;
        entity.lastSessionStartedAt = input.lastSessionStartedAt;
        entity.workspacePath = input.workspacePath ?? null;
        entity.cliSource = input.runtimeSource ?? entity.cliSource ?? null;
        await this.taskRepo.save(entity);

        await this.syncRelations(input.id, {
            ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId !== undefined ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId !== undefined ? { backgroundTaskId: input.backgroundTaskId } : {}),
        });

        const hydrated = await this.query.findById(input.id);
        if (!hydrated) throw new TaskNotFoundError(input.id);
        return hydrated;
    }

    async updateStatus(taskId: string, status: TaskStatus, updatedAt: string): Promise<MonitoringTask | null> {
        const entity = await this.taskRepo.findById(taskId);
        if (!entity) return null;
        entity.status = status;
        entity.updatedAt = updatedAt;
        await this.taskRepo.save(entity);
        return this.query.findById(taskId);
    }

    /** Apply a relation snapshot edit to the persisted relation rows. */
    private async syncRelations(
        taskId: string,
        input: { readonly parentTaskId?: string | null; readonly parentSessionId?: string | null; readonly backgroundTaskId?: string | null },
    ): Promise<void> {
        for (const tuple of TaskRelations.toSyncTuples(input)) {
            await this.relationRepo.syncRelation(taskId, tuple.kind, tuple.relatedTaskId, tuple.sessionId);
        }
    }
}
