import { Inject, Injectable } from "@nestjs/common";
import type { MonitoringTask } from "~task/domain/task.model.js";
import type { TaskStatus } from "~task/common/task.status.type.js";
import type { TimelineEvent } from "~event/public/types/event.types.js";
import { TaskDisplayTitle } from "../domain/task.display-title.model.js";
import { TaskEntity } from "../domain/task.entity.js";
import { TaskRelations, type TaskRelationsSnapshot } from "../domain/task.relations.model.js";
import { TaskRepository } from "../repository/task.repository.js";
import { TaskRelationRepository } from "../repository/task.relation.repository.js";
import { TIMELINE_EVENT_ACCESS_PORT } from "../application/outbound/tokens.js";
import type { ITimelineEventAccess } from "../application/outbound/timeline.event.access.port.js";

function toBaseTask(entity: TaskEntity, relations: TaskRelationsSnapshot): MonitoringTask {
    return {
        id: entity.id,
        title: entity.title,
        slug: entity.slug,
        status: entity.status,
        taskKind: entity.taskKind,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        ...(entity.workspacePath ? { workspacePath: entity.workspacePath } : {}),
        ...(relations.parentTaskId ? { parentTaskId: relations.parentTaskId } : {}),
        ...(relations.parentSessionId ? { parentSessionId: relations.parentSessionId } : {}),
        ...(relations.backgroundTaskId ? { backgroundTaskId: relations.backgroundTaskId } : {}),
        ...(entity.lastSessionStartedAt ? { lastSessionStartedAt: entity.lastSessionStartedAt } : {}),
        ...(entity.runtimeSource ? { runtimeSource: entity.runtimeSource } : {}),
    };
}

/**
 * Read-only task service. Hydrates entity + relations and adds derived display title.
 * Repository returns raw entities; this service composes them with the
 * TaskRelations / TaskDisplayTitle domain models.
 */
@Injectable()
export class TaskQueryService {
    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly relationRepo: TaskRelationRepository,
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
    ) {}

    async findById(id: string): Promise<MonitoringTask | null> {
        const entity = await this.taskRepo.findById(id);
        if (!entity) return null;
        const relations = TaskRelations.fromEntities(await this.relationRepo.findByTaskId(id));
        return this.withDisplayTitle(toBaseTask(entity, relations.asSnapshot()));
    }

    async findAll(): Promise<readonly MonitoringTask[]> {
        const entities = await this.taskRepo.findAll();
        if (entities.length === 0) return [];
        return this.hydrate(entities);
    }

    async findChildren(parentTaskId: string): Promise<readonly MonitoringTask[]> {
        const childIds = await this.relationRepo.findChildrenIdsOfParent(parentTaskId);
        if (childIds.length === 0) return [];
        const entities = await this.taskRepo.findByIds(childIds);
        entities.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return this.hydrate(entities);
    }

    async listTaskStatuses(): Promise<readonly TaskStatus[]> {
        return this.taskRepo.listAllStatuses();
    }

    async countTimelineEvents(): Promise<number> {
        return this.events.countAll();
    }

    /** Allow management/lifecycle services to fetch the raw entity for mutation. */
    async findEntity(id: string): Promise<{ entity: TaskEntity; relations: TaskRelationsSnapshot } | null> {
        const entity = await this.taskRepo.findById(id);
        if (!entity) return null;
        const relations = TaskRelations.fromEntities(await this.relationRepo.findByTaskId(id));
        return { entity, relations: relations.asSnapshot() };
    }

    private async hydrate(entities: readonly TaskEntity[]): Promise<readonly MonitoringTask[]> {
        const ids = entities.map((e) => e.id);
        const relationsMap = TaskRelations.groupByTaskId(
            ids,
            await this.relationRepo.findByTaskIds(ids),
        );
        return Promise.all(
            entities.map(async (entity) => {
                const relations = relationsMap.get(entity.id) ?? TaskRelations.empty();
                return this.withDisplayTitle(toBaseTask(entity, relations.asSnapshot()));
            }),
        );
    }

    private async withDisplayTitle(task: MonitoringTask): Promise<MonitoringTask> {
        const timeline = await this.events.findByTaskId(task.id);
        const displayTitle = new TaskDisplayTitle(task, timeline as unknown as readonly TimelineEvent[]).derive();
        return displayTitle ? { ...task, displayTitle } : task;
    }
}
