import { In, type Repository } from "typeorm";
import type { TaskTagEntity } from "./task-tag.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class TaskTagRepository {
    constructor(private readonly repo: Repository<TaskTagEntity>) {}

    async findByTask(userId: string, taskId: string): Promise<TaskTagEntity[]> {
        return this.repo.find({ where: { userId, taskId } });
    }

    async findByTag(userId: string, tagId: string): Promise<TaskTagEntity[]> {
        return this.repo.find({ where: { userId, tagId } });
    }

    // 태스크 목록 화면이 배지 개수를 한 번에 읽을 수 있도록 여러 태스크를 한 조회로 묶는다.
    async findByTasks(userId: string, taskIds: readonly string[]): Promise<TaskTagEntity[]> {
        if (taskIds.length === 0) return [];
        return this.repo.find({ where: { userId, taskId: In([...taskIds]) } });
    }

    // 태그 목록 화면의 taskCount용으로, tagId별 부착 개수를 센다.
    async countByTag(userId: string): Promise<Record<string, number>> {
        const rows = await this.repo.find({ where: { userId } });
        const counts: Record<string, number> = {};
        for (const row of rows) counts[row.tagId] = (counts[row.tagId] ?? 0) + 1;
        return counts;
    }

    async insertMany(rows: readonly TaskTagEntity[]): Promise<void> {
        if (rows.length === 0) return;
        await upsertByKeys(this.repo, [...rows], ["id"]);
    }

    async deleteByTaskAndTags(userId: string, taskId: string, tagIds: readonly string[]): Promise<void> {
        if (tagIds.length === 0) return;
        await this.repo.delete({ userId, taskId, tagId: In([...tagIds]) });
    }

    // 태그 자체를 지울 때 GitHub 라벨 삭제 의미론으로 그 태그의 부착 행을 모두 걷어낸다.
    async deleteByTag(userId: string, tagId: string): Promise<void> {
        await this.repo.delete({ userId, tagId });
    }
}
