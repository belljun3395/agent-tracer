import { Injectable } from "@nestjs/common";
import { TaskReadService } from "../service/task.read.service.js";
import { TaskManagementService } from "../service/task.management.service.js";
import type { ITaskAccess } from "../public/iservice/task.access.iservice.js";
import type { MonitoringTask } from "../public/types/task.types.js";
import type { TaskStatus, TaskUpsertInput } from "../public/dto/task.snapshot.dto.js";

@Injectable()
export class TaskAccessPublicAdapter implements ITaskAccess {
    constructor(
        private readonly query: TaskReadService,
        private readonly management: TaskManagementService,
    ) {}

    async findById(id: string): Promise<MonitoringTask | null> {
        return this.query.findById(id);
    }

    async findChildren(parentId: string): Promise<readonly MonitoringTask[]> {
        return this.query.findChildren(parentId);
    }

    async upsert(input: TaskUpsertInput): Promise<MonitoringTask> {
        return this.management.upsertFromDraft({
            ...input,
            lastSessionStartedAt: input.lastSessionStartedAt ?? input.updatedAt,
        });
    }

    async updateStatus(id: string, status: TaskStatus, updatedAt: string): Promise<void> {
        await this.management.updateStatus(id, status, updatedAt);
    }
}
