import { Injectable } from "@nestjs/common";
import { TaskManagementService } from "../service/task.management.service.js";
import type { LinkTaskUseCaseIn, LinkTaskUseCaseOut } from "./dto/link.task.usecase.dto.js";

@Injectable()
export class LinkTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    async execute(input: LinkTaskUseCaseIn): Promise<LinkTaskUseCaseOut> {
        return this.management.link({
            taskId: input.taskId,
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.taskKind !== undefined ? { taskKind: input.taskKind } : {}),
            ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId !== undefined ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId !== undefined ? { backgroundTaskId: input.backgroundTaskId } : {}),
        });
    }
}
