import { In } from "typeorm";
import type { Repository } from "typeorm";
import {
    CLEANUP_SUGGESTION_STATUS,
    type TaskCleanupSuggestionKind,
    type TaskCleanupSuggestionStatus,
} from "@monitor/kernel";
import type { TaskCleanupSuggestionEntity } from "./task.cleanup.suggestion.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class TaskCleanupSuggestionRepository {
    constructor(private readonly repo: Repository<TaskCleanupSuggestionEntity>) {}

    async findById(id: string): Promise<TaskCleanupSuggestionEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByUserStatus(userId: string, status: TaskCleanupSuggestionStatus): Promise<TaskCleanupSuggestionEntity[]> {
        return this.repo.find({ where: { userId, status }, order: { createdAt: "DESC" } });
    }

    async findPendingByUserTaskIds(
        userId: string,
        taskIds: readonly string[],
        kind: TaskCleanupSuggestionKind,
    ): Promise<TaskCleanupSuggestionEntity[]> {
        const uniqueTaskIds = [...new Set(taskIds)];
        if (uniqueTaskIds.length === 0) return [];
        return this.repo.find({
            where: {
                userId,
                taskId: In(uniqueTaskIds),
                kind,
                status: CLEANUP_SUGGESTION_STATUS.pending,
            },
        });
    }

    async upsert(suggestion: TaskCleanupSuggestionEntity): Promise<void> {
        await upsertByKeys(this.repo, suggestion, ["id"]);
    }
}
