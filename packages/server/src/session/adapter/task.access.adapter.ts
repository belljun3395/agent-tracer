import { Inject, Injectable } from "@nestjs/common";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import { TASK_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    ITaskAccess,
    TaskAccessRecord,
    TaskAccessStatus,
    TaskAccessUpsertInput,
} from "../application/outbound/task.access.port.js";

/**
 * Outbound adapter — bridges external task repository types to the
 * session-local ITaskAccess port. This is the only place inside session
 * module that imports from `~application/...` task module internals.
 */
@Injectable()
export class TaskAccessAdapter implements ITaskAccess {
    constructor(
        @Inject(TASK_REPOSITORY_TOKEN) private readonly inner: ITaskRepository,
    ) {}

    async findById(id: string): Promise<TaskAccessRecord | null> {
        return this.inner.findById(id);
    }

    async findChildren(parentId: string): Promise<readonly TaskAccessRecord[]> {
        return this.inner.findChildren(parentId);
    }

    async upsert(input: TaskAccessUpsertInput): Promise<TaskAccessRecord> {
        return this.inner.upsert(input);
    }

    async updateStatus(
        id: string,
        status: TaskAccessStatus,
        updatedAt: string,
    ): Promise<void> {
        return this.inner.updateStatus(id, status, updatedAt);
    }
}
