import { In, type Repository } from "typeorm";
import type { TaskUserStateEntity } from "./task.user.state.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class TaskUserStateRepository {
    constructor(private readonly repo: Repository<TaskUserStateEntity>) {}

    async findById(taskId: string): Promise<TaskUserStateEntity | null> {
        return this.repo.findOne({ where: { taskId } });
    }

    async findByIds(taskIds: readonly string[]): Promise<TaskUserStateEntity[]> {
        if (taskIds.length === 0) return [];
        return this.repo.find({ where: { taskId: In([...taskIds]) } });
    }

    async findByUser(userId: string): Promise<TaskUserStateEntity[]> {
        return this.repo.find({ where: { userId } });
    }

    async save(state: TaskUserStateEntity): Promise<void> {
        await upsertByKeys(this.repo, state, ["taskId"]);
    }
}
