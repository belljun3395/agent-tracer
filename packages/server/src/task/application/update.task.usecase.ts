import { Injectable } from "@nestjs/common";
import { TaskManagementService } from "../service/task.management.service.js";
import type { UpdateTaskUseCaseIn, UpdateTaskUseCaseOut } from "./dto/update.task.usecase.dto.js";

@Injectable()
export class UpdateTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    async execute(input: UpdateTaskUseCaseIn): Promise<UpdateTaskUseCaseOut> {
        const updated = await this.management.update({
            taskId: input.taskId,
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
        });
        return updated;
    }
}
