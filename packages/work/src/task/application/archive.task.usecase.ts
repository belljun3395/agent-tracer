import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskAlreadyArchivedError, TaskNotFoundError } from "../common/task.errors.js";
import { TaskManagementService } from "../service/task.management.service.js";
import type {
    ArchiveTaskUseCaseIn,
    ArchiveTaskUseCaseOut,
} from "./dto/archive.task.usecase.dto.js";

@Injectable()
export class ArchiveTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    @Transactional()
    async execute(input: ArchiveTaskUseCaseIn): Promise<ArchiveTaskUseCaseOut> {
        const result = await this.management.archive(input.taskId);
        if (result.status === "not_found") throw new TaskNotFoundError(input.taskId);
        if (result.status === "already_archived") throw new TaskAlreadyArchivedError(input.taskId);
        return { archivedIds: result.archivedIds, archivedAt: result.archivedAt };
    }
}
