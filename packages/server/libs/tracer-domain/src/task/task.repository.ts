import { In, type Repository, type SelectQueryBuilder } from "typeorm";
import { RUNNING_TASK_STATUS, WAITING_TASK_STATUS } from "@monitor/kernel";
import type { TaskEntity } from "./task.entity.js";
import type { TaskPageFilter } from "./task.const.js";
import { TaskView } from "./task.view.domain.js";
import { TaskUserStateEntity } from "./user-state/task.user.state.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

type TaskWithListState = TaskEntity & { readonly listState?: TaskUserStateEntity | null };

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

    // 서브에이전트 트리의 깊이를 알 수 없어 한 겹씩 넓히며 걷고, 이미 본 id를 걸러 순환이 있어도 끝나게 한다.
    async findDescendantIds(rootId: string, userId: string): Promise<string[]> {
        const out: string[] = [];
        const seen = new Set<string>([rootId]);
        let frontier = [rootId];
        while (frontier.length > 0) {
            const children = await this.repo.find({ where: { parentTaskId: In(frontier), userId } });
            frontier = [];
            for (const child of children) {
                if (seen.has(child.id)) continue;
                seen.add(child.id);
                out.push(child.id);
                frontier.push(child.id);
            }
        }
        return out;
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

    async findPage(userId: string, filter: TaskPageFilter): Promise<TaskEntity[]> {
        const qb = this.buildPageQuery(userId, filter);
        if (filter.archived !== undefined) {
            qb.leftJoin("task_user_state", "s", "s.task_id = t.id AND s.user_id = :stateUserId", {
                stateUserId: userId,
            });
            qb.andWhere(filter.archived ? "s.archived_at IS NOT NULL" : "s.archived_at IS NULL");
        }
        return qb.getMany();
    }

    /** 목록 표시값에 필요한 사용자 상태를 같은 쿼리로 읽고, 숨김을 페이지 상한 전에 제외한다. */
    async findVisiblePage(userId: string, filter: TaskPageFilter): Promise<TaskView[]> {
        const qb = this.buildPageQuery(userId, filter)
            .leftJoinAndMapOne(
                "t.listState",
                TaskUserStateEntity,
                "s",
                "s.task_id = t.id AND s.user_id = :stateUserId",
                { stateUserId: userId },
            )
            .andWhere("s.hidden_at IS NULL");

        if (filter.archived !== undefined) {
            qb.andWhere(filter.archived ? "s.archived_at IS NOT NULL" : "s.archived_at IS NULL");
        }

        const tasks = (await qb.getMany()) as TaskWithListState[];
        return tasks.map((task) => new TaskView(task, task.listState ?? null));
    }

    async upsert(task: TaskEntity): Promise<void> {
        await upsertByKeys(this.repo, task, ["id"]);
    }

    private buildPageQuery(userId: string, filter: TaskPageFilter): SelectQueryBuilder<TaskEntity> {
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
        return qb;
    }
}
