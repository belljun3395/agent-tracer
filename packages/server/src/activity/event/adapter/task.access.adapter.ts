import { Inject, Injectable } from "@nestjs/common";
import type { ITaskAccess } from "~work/task/public/iservice/task.access.iservice.js";
import { TASK_ACCESS } from "~work/task/public/tokens.js";
import type {
    EventTaskRecord,
    EventTaskStatus,
    IEventTaskAccess,
} from "../application/outbound/task.access.port.js";

/**
 * Outbound adapter — bridges task module's public ITaskAccess to the
 * event-local IEventTaskAccess port (narrowed to just findById + updateStatus).
 */
@Injectable()
export class EventTaskAccessAdapter implements IEventTaskAccess {
    constructor(
        @Inject(TASK_ACCESS) private readonly inner: ITaskAccess,
    ) {}

    async findById(id: string): Promise<EventTaskRecord | null> {
        const task = await this.inner.findById(id);
        if (!task) return null;
        return {
            id: task.id,
            status: task.status,
            title: task.title,
            slug: task.slug,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        };
    }

    async updateStatus(id: string, status: EventTaskStatus, updatedAt: string): Promise<void> {
        return this.inner.updateStatus(id, status, updatedAt);
    }
}
