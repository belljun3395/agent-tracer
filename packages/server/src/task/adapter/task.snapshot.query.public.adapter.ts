import { Injectable } from "@nestjs/common";
import { TaskQueryService } from "../service/task.query.service.js";
import type { ITaskSnapshotQuery } from "../public/iservice/task.snapshot.query.iservice.js";
import type { TaskSnapshot, TaskStatus } from "../public/dto/task.snapshot.dto.js";

@Injectable()
export class TaskSnapshotQueryPublicAdapter implements ITaskSnapshotQuery {
    constructor(private readonly query: TaskQueryService) {}

    async findAll(): Promise<readonly TaskSnapshot[]> {
        const tasks = await this.query.findAll();
        return tasks as readonly TaskSnapshot[];
    }

    listTaskStatuses(): Promise<readonly TaskStatus[]> {
        return this.query.listTaskStatuses() as Promise<readonly TaskStatus[]>;
    }

    countTimelineEvents(): Promise<number> {
        return this.query.countTimelineEvents();
    }
}
