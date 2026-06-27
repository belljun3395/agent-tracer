import { Inject, Injectable } from "@nestjs/common";
import type { ITaskAccess as ITaskAccessPublic } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import { TASK_ACCESS } from "@monitor/run-api/task/public/tokens.js";
import type { ITaskAccess, TaskAccessRecord } from "../application/outbound/task.access.port.js";

@Injectable()
export class TaskAccessAdapter implements ITaskAccess {
    constructor(
        @Inject(TASK_ACCESS) private readonly inner: ITaskAccessPublic,
    ) {}

    async findById(id: string): Promise<TaskAccessRecord | null> {
        const result = await this.inner.findById(id);
        return result ? { id: result.id } : null;
    }
}
