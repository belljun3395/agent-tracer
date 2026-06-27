import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { TaskStatus } from "@monitor/run-api/task/common/task.status.const.js";
import { TaskEntity } from "../domain/task.entity.js";

@Injectable()
export class TaskRepository implements OnModuleInit {
    private readonly logger = new Logger(TaskRepository.name);

    constructor(
        @InjectRepository(TaskEntity)
        private readonly repo: Repository<TaskEntity>,
    ) {}

    async onModuleInit(): Promise<void> {
        try {
            await this.repo.manager.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
            await this.repo.manager.query(
                `CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON tasks USING gin (title gin_trgm_ops)`,
            );
        } catch (error) {
            this.logger.warn(
                `tasks pg_trgm index bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async findById(id: string): Promise<TaskEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async searchByText(userId: string, query: string, limit: number): Promise<TaskEntity[]> {
        const pattern = `%${query}%`;
        return this.repo
            .createQueryBuilder("t")
            .where("t.user_id = :userId", { userId })
            .andWhere("(t.title ILIKE :pattern OR COALESCE(t.workspace_path, '') ILIKE :pattern)", { pattern })
            .orderBy("t.updated_at", "DESC")
            .limit(limit)
            .getMany();
    }

    async findAll(): Promise<TaskEntity[]> {
        return this.repo.find({ order: { updatedAt: "DESC" } });
    }

    async findAllByArchivedScope(
        scope: "active" | "archived" | "all",
        userId: string,
    ): Promise<TaskEntity[]> {
        const qb = this.repo
            .createQueryBuilder("t")
            .where("t.user_id = :userId", { userId })
            .orderBy("t.updated_at", "DESC");
        if (scope === "active") {
            qb.andWhere("t.archived_at IS NULL");
        } else if (scope === "archived") {
            qb.andWhere("t.archived_at IS NOT NULL");
        }
        return qb.getMany();
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

    async listAllStatuses(userId: string): Promise<readonly TaskStatus[]> {
        const rows = await this.repo
            .createQueryBuilder("t")
            .select("t.status", "status")
            .where("t.user_id = :userId", { userId })
            .getRawMany<{ status: TaskStatus }>();
        return rows.map((row) => row.status);
    }

    async listIdsByStatuses(statuses: readonly TaskStatus[]): Promise<readonly string[]> {
        if (statuses.length === 0) return [];
        const rows = await this.repo
            .createQueryBuilder("t")
            .select("t.id", "id")
            .where("t.status IN (:...statuses)", { statuses: [...statuses] })
            .getRawMany<{ id: string }>();
        return rows.map((row) => row.id);
    }

    async findByStatusesUpdatedBefore(
        statuses: readonly TaskStatus[],
        thresholdIso: string,
        limit: number,
    ): Promise<readonly TaskEntity[]> {
        if (statuses.length === 0) return [];
        return this.repo
            .createQueryBuilder("t")
            .where("t.status IN (:...statuses)", { statuses: [...statuses] })
            .andWhere("t.updated_at < :threshold", { threshold: thresholdIso })
            .orderBy("t.updated_at", "ASC")
            .limit(limit)
            .getMany();
    }

    async collectDescendantIds(taskId: string): Promise<readonly string[]> {
        const rows = await this.repo.query<readonly { id: string }[]>(
            `with recursive task_tree(id) as (
               select id from tasks where id = $1
               union all
               select relation.task_id
               from task_relations relation
               join task_tree parent on relation.related_task_id = parent.id
               where relation.relation_kind = 'parent'
             )
             select id from task_tree where id != $1`,
            [taskId],
        );
        return rows.map((row) => row.id);
    }
}
