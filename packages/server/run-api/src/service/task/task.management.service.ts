import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { MonitoringTask } from "@monitor/run-api/domain/task/type/task.type.js";
import type {
    TaskStatus,
    MonitoringTaskKind,
    TaskOrigin,
} from "@monitor/run-api/domain/task/task.status.const.js";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { TaskNotFoundError } from "../../domain/task/task.errors.js";
import { createTaskSlug } from "../../domain/task/task.slug.js";
import { TaskEntity } from "../../domain/task/task.entity.js";
import { TaskRelations } from "../../domain/task/task.relations.vo.js";
import { TaskRepository } from "../../repository/task/task.repository.js";
import { TaskRelationRepository } from "../../repository/task/task.relation.repository.js";
import { TaskReadService } from "./task.read.service.js";
import { CLOCK_PORT, NOTIFICATION_PUBLISHER_PORT } from "../../application/task/outbound/tokens.js";
import type { IClock } from "../../application/task/outbound/clock.port.js";
import type { ITaskNotificationPublisher } from "../../application/task/outbound/notification.publisher.port.js";

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
        private readonly query: TaskReadService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ITaskNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    async update(input: TaskUpdateInput): Promise<MonitoringTask | null> {
        const task = await this.query.findById(input.taskId);
        if (!task) return null;

        const titleUpdate = input.title !== undefined ? input.title.trim() : undefined;
        const hasNewTitle = titleUpdate !== undefined && titleUpdate !== task.title;
        const hasNewStatus = input.status !== undefined && input.status !== task.status;
        if (!hasNewTitle && !hasNewStatus) return task;

        const entity = await this.taskRepo.findOwned(input.taskId, currentUserId());
        if (!entity) return null;
        if (hasNewTitle) {
            entity.title = titleUpdate;
            entity.slug = createTaskSlug({ title: titleUpdate });
        }
        if (hasNewStatus) {
            entity.status = input.status;
        }
        entity.updatedAt = this.clock.nowIso();
        await this.taskRepo.save(entity);

        const updated = await this.query.findById(input.taskId);
        if (updated) {
            this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
        }
        return updated;
    }

    async link(input: TaskLinkInput): Promise<MonitoringTask> {
        const entity = await this.taskRepo.findOwned(input.taskId, currentUserId());
        if (!entity) throw new TaskNotFoundError(input.taskId);

        const titleTrimmed = input.title?.trim();
        if (titleTrimmed) {
            entity.title = titleTrimmed;
            entity.slug = createTaskSlug({ title: titleTrimmed });
        }
        if (input.taskKind) {
            entity.taskKind = input.taskKind;
        }
        entity.updatedAt = this.clock.nowIso();
        await this.taskRepo.save(entity);

        await this.syncRelations(input.taskId, {
            ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId !== undefined ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId !== undefined ? { backgroundTaskId: input.backgroundTaskId } : {}),
        });

        const updated = await this.query.findById(input.taskId);
        if (!updated) throw new TaskNotFoundError(input.taskId);
        this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
        return updated;
    }

    async delete(taskId: string): Promise<{ status: "deleted"; deletedIds: readonly string[] } | { status: "not_found" }> {
        const ownerId = currentUserId();
        const exists = await this.taskRepo.findOwned(taskId, ownerId);
        if (!exists) return { status: "not_found" };

        const descendants = await this.taskRepo.collectDescendantIds(taskId);
        const allIds = [taskId, ...descendants];
        await this.taskRepo.deleteByIds(allIds, ownerId);

        for (const id of allIds) {
            this.notifier.publish({ type: NOTIFICATION_TYPE.taskDeleted, payload: { taskId: id } });
        }
        return { status: "deleted", deletedIds: allIds };
    }

    async archive(
        taskId: string,
    ): Promise<{ status: "archived"; archivedIds: readonly string[]; archivedAt: string } | { status: "not_found" } | { status: "already_archived" }> {
        const ownerId = currentUserId();
        const exists = await this.taskRepo.findOwned(taskId, ownerId);
        if (!exists) return { status: "not_found" };
        if (exists.isArchived()) return { status: "already_archived" };

        const descendants = await this.taskRepo.collectDescendantIds(taskId);
        const allIds = [taskId, ...descendants];
        const archivedAt = this.clock.nowIso();
        for (const id of allIds) {
            const entity = await this.taskRepo.findOwned(id, ownerId);
            if (!entity || entity.isArchived()) continue;
            entity.archive(archivedAt);
            await this.taskRepo.save(entity);
            const updated = await this.query.findById(id);
            if (updated) this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
        }
        return { status: "archived", archivedIds: allIds, archivedAt };
    }

    async unarchive(
        taskId: string,
    ): Promise<{ status: "unarchived"; unarchivedIds: readonly string[] } | { status: "not_found" } | { status: "not_archived" }> {
        const ownerId = currentUserId();
        const exists = await this.taskRepo.findOwned(taskId, ownerId);
        if (!exists) return { status: "not_found" };
        if (!exists.isArchived()) return { status: "not_archived" };

        const descendants = await this.taskRepo.collectDescendantIds(taskId);
        const allIds = [taskId, ...descendants];
        const now = this.clock.nowIso();
        const unarchivedIds: string[] = [];
        for (const id of allIds) {
            const entity = await this.taskRepo.findOwned(id, ownerId);
            if (!entity || !entity.isArchived()) continue;
            entity.unarchive(now);
            await this.taskRepo.save(entity);
            unarchivedIds.push(id);
            const updated = await this.query.findById(id);
            if (updated) this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
        }
        return { status: "unarchived", unarchivedIds };
    }

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
        readonly origin?: TaskOrigin;
    }): Promise<MonitoringTask> {
        const existing = await this.taskRepo.findOwned(input.id, currentUserId());
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

        if (!existing) {
            // 새 태스크는 현재 사용자 범위에 귀속하고 origin 기본값을 user로 둔다.
            entity.origin = input.origin ?? "user";
            entity.userId = currentUserId();
        } else if (input.origin === "server-sdk" && existing.origin !== "server-sdk") {
            // server-sdk로 승격된 태스크는 이후 재개에서 user로 낮추지 않는다.
            entity.origin = "server-sdk";
        }
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

    async updateSlug(taskId: string, slug: string): Promise<MonitoringTask | null> {
        const entity = await this.taskRepo.findOwned(taskId, currentUserId());
        if (!entity) return null;
        const trimmed = slug.trim();
        // 빈 slug나 기존 slug와 같은 값은 저장하지 않고 현재 상태만 반환한다.
        if (!trimmed || trimmed === entity.slug) return this.query.findById(taskId);
        entity.slug = trimmed;
        entity.updatedAt = this.clock.nowIso();
        await this.taskRepo.save(entity);
        const updated = await this.query.findById(taskId);
        if (updated) this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: updated });
        return updated;
    }

    async updateStatus(taskId: string, status: TaskStatus, updatedAt: string): Promise<MonitoringTask | null> {
        const entity = await this.taskRepo.findOwned(taskId, currentUserId());
        if (!entity) return null;
        entity.status = status;
        entity.updatedAt = updatedAt;
        await this.taskRepo.save(entity);
        return this.query.findById(taskId);
    }

    private async syncRelations(
        taskId: string,
        input: { readonly parentTaskId?: string | null; readonly parentSessionId?: string | null; readonly backgroundTaskId?: string | null },
    ): Promise<void> {
        for (const tuple of TaskRelations.toSyncTuples(input)) {
            await this.relationRepo.syncRelation(taskId, tuple.kind, tuple.relatedTaskId, tuple.sessionId);
        }
    }
}
