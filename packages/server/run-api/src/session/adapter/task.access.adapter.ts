import { Inject, Injectable } from "@nestjs/common";
import type { ITaskAccess as ITaskAccessPublic } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import { TASK_ACCESS } from "@monitor/run-api/task/public/tokens.js";
import type {
    ITaskAccess,
    TaskAccessRecord,
    TaskAccessStatus,
    TaskAccessUpsertInput,
} from "../application/outbound/task.access.port.js";

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
