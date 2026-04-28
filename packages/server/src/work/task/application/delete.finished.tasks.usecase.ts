import { Injectable } from "@nestjs/common";
import { TaskManagementService } from "../service/task.management.service.js";
import type {
    DeleteFinishedTasksUseCaseIn,
    DeleteFinishedTasksUseCaseOut,
} from "./dto/delete.finished.tasks.usecase.dto.js";

@Injectable()
export class DeleteFinishedTasksUseCase {
    constructor(private readonly management: TaskManagementService) {}

    async execute(_input: DeleteFinishedTasksUseCaseIn): Promise<DeleteFinishedTasksUseCaseOut> {
        return this.management.deleteFinished();
    }
}
