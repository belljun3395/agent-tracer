import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskNotFoundError } from "../../domain/task/task.errors.js";
import { TaskManagementService } from "../../service/task/task.management.service.js";
import type { DeleteTaskUseCaseIn } from "./dto/delete.task.usecase.dto.js";

@Injectable()
export class DeleteTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    @Transactional()
    async execute(input: DeleteTaskUseCaseIn): Promise<void> {
        const result = await this.management.delete(input.taskId);
        if (result.status === "not_found") throw new TaskNotFoundError(input.taskId);
    }
}
