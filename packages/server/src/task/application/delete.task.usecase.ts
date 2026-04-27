import { Injectable } from "@nestjs/common";
import { TaskManagementService } from "../service/task.management.service.js";
import type { DeleteTaskUseCaseIn, DeleteTaskUseCaseOut } from "./dto/delete.task.usecase.dto.js";

@Injectable()
export class DeleteTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    async execute(input: DeleteTaskUseCaseIn): Promise<DeleteTaskUseCaseOut> {
        const result = await this.management.delete(input.taskId);
        return { status: result.status };
    }
}
