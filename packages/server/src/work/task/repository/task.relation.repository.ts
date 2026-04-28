import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TaskRelationEntity, type TaskRelationKind } from "../domain/task.relation.entity.js";

/**
 * Plain CRUD over task_relations rows. Domain semantics (which relation_kind
 * means what, how to project rows into a snapshot) live in TaskRelations
 * domain model — not here.
 */
@Injectable()
export class TaskRelationRepository {
    constructor(
        @InjectRepository(TaskRelationEntity)
        private readonly repo: Repository<TaskRelationEntity>,
    ) {}

    async findByTaskId(taskId: string): Promise<TaskRelationEntity[]> {
        return this.repo.find({ where: { taskId } });
    }

    async findByTaskIds(taskIds: readonly string[]): Promise<TaskRelationEntity[]> {
        if (taskIds.length === 0) return [];
        return this.repo.find({ where: { taskId: In([...taskIds]) } });
    }

    async findChildrenIdsOfParent(parentTaskId: string): Promise<readonly string[]> {
        const rows = await this.repo
            .createQueryBuilder("r")
            .select("r.task_id", "taskId")
            .where("r.related_task_id = :parentId AND r.relation_kind = :kind", {
                parentId: parentTaskId,
                kind: "parent" satisfies TaskRelationKind,
            })
            .getRawMany<{ taskId: string }>();
        return rows.map((row) => row.taskId);
    }

    async syncRelation(
        taskId: string,
        relationKind: TaskRelationKind,
        relatedTaskId: string | null,
        sessionId: string | null,
    ): Promise<void> {
        await this.repo.delete({ taskId, relationKind });
        if (!relatedTaskId && !sessionId) return;
        const entity = new TaskRelationEntity();
        entity.taskId = taskId;
        entity.relationKind = relationKind;
        entity.relatedTaskId = relatedTaskId;
        entity.sessionId = sessionId;
        await this.repo.save(entity);
    }
}
