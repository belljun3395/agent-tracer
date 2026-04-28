import { Injectable } from "@nestjs/common";
import { TaskQueryService } from "../service/task.query.service.js";
import { TaskManagementService } from "../service/task.management.service.js";
import type { ITaskAccess } from "../public/iservice/task.access.iservice.js";
import type {
    TaskSnapshot,
    TaskStatus,
    TaskUpsertInput,
} from "../public/dto/task.snapshot.dto.js";

/**
 * Public adapter — implements ITaskAccess by delegating to internal services.
 * Maps internal MonitoringTask shape to TaskSnapshot (structurally equivalent).
 */
@Injectable()
export class TaskAccessPublicAdapter implements ITaskAccess {
    constructor(
        private readonly query: TaskQueryService,
        private readonly management: TaskManagementService,
    ) {}

    async findById(id: string): Promise<TaskSnapshot | null> {
        const task = await this.query.findById(id);
        return task as TaskSnapshot | null;
    }

    async findChildren(parentId: string): Promise<readonly TaskSnapshot[]> {
        const tasks = await this.query.findChildren(parentId);
        return tasks as readonly TaskSnapshot[];
    }

    async upsert(input: TaskUpsertInput): Promise<TaskSnapshot> {
        const task = await this.management.upsertFromDraft({
            ...input,
            lastSessionStartedAt: input.lastSessionStartedAt ?? input.updatedAt,
        });
        return task as TaskSnapshot;
    }

    async updateStatus(id: string, status: TaskStatus, updatedAt: string): Promise<void> {
        await this.management.updateStatus(id, status, updatedAt);
    }
}
