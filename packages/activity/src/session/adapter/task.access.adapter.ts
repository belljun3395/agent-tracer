import { Inject, Injectable } from "@nestjs/common";
import type { ITaskAccess as ITaskAccessPublic } from "@monitor/work/task/public/iservice/task.access.iservice.js";
import { TASK_ACCESS } from "@monitor/work/task/public/tokens.js";
import type {
    ITaskAccess,
    TaskAccessRecord,
    TaskAccessStatus,
    TaskAccessUpsertInput,
} from "../application/outbound/task.access.port.js";

/**
 * Outbound adapter — bridges task module's public ITaskAccess to the
 * session-local ITaskAccess port. Only place inside session that imports
 * from another module (and only via that module's public/ surface).
 */
@Injectable()
export class TaskAccessAdapter implements ITaskAccess {
    constructor(
        @Inject(TASK_ACCESS) private readonly inner: ITaskAccessPublic,
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

    updateStatus(
        id: string,
        status: TaskAccessStatus,
        updatedAt: string,
    ): Promise<void> {
        return this.inner.updateStatus(id, status, updatedAt);
    }
}
