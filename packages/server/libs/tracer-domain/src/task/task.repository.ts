import { In, type Repository } from "typeorm";
import { RUNNING_TASK_STATUS, WAITING_TASK_STATUS } from "@monitor/kernel";
import type { TaskEntity } from "./task.entity.js";
import type { TaskPageFilter } from "./task.const.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class TaskRepository {
    constructor(private readonly repo: Repository<TaskEntity>) {}

    async findById(id: string): Promise<TaskEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByIds(ids: readonly string[]): Promise<TaskEntity[]> {
        if (ids.length === 0) return [];
        return this.repo.find({ where: { id: In([...ids]) } });
    }

    async findByUser(userId: string): Promise<TaskEntity[]> {
        return this.repo.find({ where: { userId }, order: { updatedAt: "DESC" } });
    }

    async findChildren(taskId: string): Promise<TaskEntity[]> {
        return this.repo.find({ where: { parentTaskId: taskId } });
    }

    // 정리 후보 판정용으로 부모 id 목록에 속한 자식 중 running/waiting만 상한 없이 직접 조회해, 부모 목록이 페이지에 잘려도 활성 자식 존재 여부가 틀리지 않는다.
    async findActiveChildren(parentTaskIds: readonly string[]): Promise<TaskEntity[]> {
        if (parentTaskIds.length === 0) return [];
        return this.repo
            .createQueryBuilder("t")
            .where("t.parent_task_id IN (:...parentTaskIds)", { parentTaskIds: [...parentTaskIds] })
            .andWhere("t.status IN (:...statuses)", { statuses: [RUNNING_TASK_STATUS, WAITING_TASK_STATUS] })
            .getMany();
    }

    // 부모가 있는 자식 작업 중 running/waiting인데 before 이전부터 조용한 것들로, 완료 신호를 놓쳐 고착된 서브에이전트·백그라운드 워커를 reaper가 회수하기 위한 후보다.
    async findReapableChildren(before: Date, limit: number): Promise<TaskEntity[]> {
        return this.repo
            .createQueryBuilder("t")
            .where("t.parent_task_id IS NOT NULL")
            .andWhere("t.status IN (:...statuses)", { statuses: [RUNNING_TASK_STATUS, WAITING_TASK_STATUS] })
            .andWhere("COALESCE(t.last_event_at, t.updated_at) < :before", { before })
            .orderBy("t.updated_at", "ASC")
            .limit(limit)
            .getMany();
    }

    async findPage(userId: string, filter: TaskPageFilter): Promise<TaskEntity[]> {
        const qb = this.repo
            .createQueryBuilder("t")
            .where("t.user_id = :userId", { userId })
            .orderBy("t.updated_at", "DESC")
            .addOrderBy("t.id", "DESC")
            .limit(filter.limit);

        if (filter.status !== undefined) qb.andWhere("t.status = :status", { status: filter.status });
        if (filter.origin !== undefined) qb.andWhere("t.origin = :origin", { origin: filter.origin });
        if (filter.rootOnly === true) qb.andWhere("t.parent_task_id IS NULL");
        if (filter.parentTaskId !== undefined) {
            qb.andWhere("t.parent_task_id = :parentTaskId", { parentTaskId: filter.parentTaskId });
        }
        if (filter.cursor !== undefined) {
            qb.andWhere("(t.updated_at < :cursorAt OR (t.updated_at = :cursorAt AND t.id < :cursorId))", {
                cursorAt: filter.cursor.updatedAt,
                cursorId: filter.cursor.id,
            });
        }
        if (filter.archived !== undefined) {
            qb.leftJoin("task_user_state", "s", "s.task_id = t.id");
            qb.andWhere(filter.archived ? "s.archived_at IS NOT NULL" : "s.archived_at IS NULL");
        }
        return qb.getMany();
    }

    async upsert(task: TaskEntity): Promise<void> {
        await upsertByKeys(this.repo, task, ["id"]);
    }
}
