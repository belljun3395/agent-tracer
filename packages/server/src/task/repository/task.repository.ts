import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { TaskStatus } from "~task/common/task.status.type.js";
import { TaskEntity } from "../domain/task.entity.js";

@Injectable()
export class TaskRepository {
    constructor(
        @InjectRepository(TaskEntity)
        private readonly repo: Repository<TaskEntity>,
    ) {}

    async findById(id: string): Promise<TaskEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findAll(): Promise<TaskEntity[]> {
        return this.repo.find({ order: { updatedAt: "DESC" } });
    }

    async findByIds(ids: readonly string[]): Promise<TaskEntity[]> {
        if (ids.length === 0) return [];
        return this.repo.find({ where: { id: In([...ids]) } });
    }

    async save(entity: TaskEntity): Promise<TaskEntity> {
        return this.repo.save(entity);
    }

    async deleteByIds(ids: readonly string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.repo.delete({ id: In([...ids]) });
    }

    async listAllStatuses(): Promise<readonly TaskStatus[]> {
        const rows = await this.repo
            .createQueryBuilder("t")
            .select("t.status", "status")
            .getRawMany<{ status: TaskStatus }>();
        return rows.map((row) => row.status);
    }

    /**
     * Generic — caller (domain/service) supplies the status set. Repository
     * doesn't decide which statuses count as "finished" / "running" / etc.
     */
    async listIdsByStatuses(statuses: readonly TaskStatus[]): Promise<readonly string[]> {
        if (statuses.length === 0) return [];
        const rows = await this.repo
            .createQueryBuilder("t")
            .select("t.id", "id")
            .where("t.status IN (:...statuses)", { statuses: [...statuses] })
            .getRawMany<{ id: string }>();
        return rows.map((row) => row.id);
    }

    /**
     * SQL-bound recursive descent over the task hierarchy via `parent`
     * relations. The relation kind is the only domain hook in this query —
     * the rest is plain CTE traversal.
     */
    async collectDescendantIds(taskId: string): Promise<readonly string[]> {
        const rows = await this.repo.query<readonly { id: string }[]>(
            `with recursive task_tree(id) as (
               select id from tasks_current where id = ?
               union all
               select relation.task_id
               from task_relations relation
               join task_tree parent on relation.related_task_id = parent.id
               where relation.relation_kind = 'parent'
             )
             select id from task_tree where id != ?`,
            [taskId, taskId],
        );
        return rows.map((row) => row.id);
    }
}
