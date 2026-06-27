import { Inject, Injectable } from "@nestjs/common";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import type { MonitoringTask } from "@monitor/run-api/task/domain/task.model.js";
import type { TaskStatus } from "@monitor/run-api/task/common/task.status.const.js";
import { TaskDisplayTitle } from "../domain/task.display.title.model.js";
import { TaskEntity } from "../domain/task.entity.js";
import { TaskRelations, type TaskRelationsSnapshot } from "../domain/task.relations.model.js";
import { TaskRepository } from "../repository/task.repository.js";
import { TaskRelationRepository } from "../repository/task.relation.repository.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/event/public/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/event/public/iservice/timeline.event.read.iservice.js";
import { tallyTaskStatuses } from "../common/task.status.helpers.js";
import type { DashboardSnapshot } from "../public/dto/task.snapshot.dto.js";

function toBaseTask(entity: TaskEntity, relations: TaskRelationsSnapshot): MonitoringTask {
    return {
        id: entity.id,
        title: entity.title,
        slug: entity.slug,
        status: entity.status,
        taskKind: entity.taskKind,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        origin: entity.origin,
        ...(entity.workspacePath ? { workspacePath: entity.workspacePath } : {}),
        ...(relations.parentTaskId ? { parentTaskId: relations.parentTaskId } : {}),
        ...(relations.parentSessionId ? { parentSessionId: relations.parentSessionId } : {}),
        ...(relations.backgroundTaskId ? { backgroundTaskId: relations.backgroundTaskId } : {}),
        ...(entity.lastSessionStartedAt ? { lastSessionStartedAt: entity.lastSessionStartedAt } : {}),
        ...(entity.runtimeSource ? { runtimeSource: entity.runtimeSource } : {}),
        ...(entity.archivedAt ? { archivedAt: entity.archivedAt } : {}),
    };
}

@Injectable()
export class TaskReadService {
    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly relationRepo: TaskRelationRepository,
        @Inject(TIMELINE_EVENT_READ) private readonly events: ITimelineEventRead,
    ) {}

    async findById(id: string): Promise<MonitoringTask | null> {
        const entity = await this.taskRepo.findById(id);
        if (!entity || entity.userId !== currentUserId()) return null;
        const relations = TaskRelations.fromEntities(await this.relationRepo.findByTaskId(id));
        return this.withDisplayTitle(toBaseTask(entity, relations.asSnapshot()));
    }

    async searchTasks(query: string, limit: number): Promise<readonly TaskEntity[]> {
        return this.taskRepo.searchByText(currentUserId(), query, limit);
    }

    async findAll(scope: "active" | "archived" | "all" = "active"): Promise<readonly MonitoringTask[]> {
        const entities = await this.taskRepo.findAllByArchivedScope(scope, currentUserId());
        if (entities.length === 0) return [];
        return this.hydrate(entities);
    }

    async findChildren(parentTaskId: string): Promise<readonly MonitoringTask[]> {
        const childIds = await this.relationRepo.findChildrenIdsOfParent(parentTaskId);
        if (childIds.length === 0) return [];
        const userId = currentUserId();
        const entities = (await this.taskRepo.findByIds(childIds)).filter((e) => e.userId === userId);
        entities.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return this.hydrate(entities);
    }

    async listTaskStatuses(): Promise<readonly TaskStatus[]> {
        return this.taskRepo.listAllStatuses(currentUserId());
    }

    async countTimelineEvents(): Promise<number> {
        return this.events.countAll();
    }

    async buildDashboardSnapshot(): Promise<DashboardSnapshot> {
        const [statuses, totalEvents, tasks] = await Promise.all([
            this.listTaskStatuses(),
            this.countTimelineEvents(),
            this.findAll(),
        ]);
        return {
            stats: { ...tallyTaskStatuses(statuses), totalEvents },
            tasks,
        };
    }

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
        const fromTaskOnly = new TaskDisplayTitle(task, []);
        if (!fromTaskOnly.needsTimeline()) {
            const displayTitle = fromTaskOnly.derive();
            return displayTitle ? { ...task, displayTitle } : task;
        }
        // 태스크 자체 정보로 제목을 만들 수 없을 때만 타임라인을 읽어 N+1 비용을 제한한다.
        const timeline = await this.events.findByTaskId(task.id);
        const displayTitle = new TaskDisplayTitle(task, timeline).derive();
        return displayTitle ? { ...task, displayTitle } : task;
    }
}
