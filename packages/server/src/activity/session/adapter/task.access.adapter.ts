import { Inject, Injectable } from "@nestjs/common";
import type { ITaskAccess as ITaskAccessPublic } from "~work/task/public/iservice/task.access.iservice.js";
import { TASK_ACCESS } from "~work/task/public/tokens.js";
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
        const result = await this.inner.findById(id);
        return result as TaskAccessRecord | null;
    }

    async findChildren(parentId: string): Promise<readonly TaskAccessRecord[]> {
        const result = await this.inner.findChildren(parentId);
        return result as unknown as readonly TaskAccessRecord[];
    }

    async upsert(input: TaskAccessUpsertInput): Promise<TaskAccessRecord> {
        const result = await this.inner.upsert(input);
        return result as TaskAccessRecord;
    }

    updateStatus(
        id: string,
        status: TaskAccessStatus,
        updatedAt: string,
    ): Promise<void> {
        return this.inner.updateStatus(id, status, updatedAt);
    }
}
