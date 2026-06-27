import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskNotArchivedError, TaskNotFoundError } from "../common/task.errors.js";
import { TaskManagementService } from "../service/task.management.service.js";
import type {
    UnarchiveTaskUseCaseIn,
    UnarchiveTaskUseCaseOut,
} from "./dto/archive.task.usecase.dto.js";

@Injectable()
export class UnarchiveTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    @Transactional()
    async execute(input: UnarchiveTaskUseCaseIn): Promise<UnarchiveTaskUseCaseOut> {
        const result = await this.management.unarchive(input.taskId);
        if (result.status === "not_found") throw new TaskNotFoundError(input.taskId);
        if (result.status === "not_archived") throw new TaskNotArchivedError(input.taskId);
        return { unarchivedIds: result.unarchivedIds };
    }
}
