import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskManagementService } from "../service/task.management.service.js";
import type {
    DeleteFinishedTasksUseCaseIn,
    DeleteFinishedTasksUseCaseOut,
} from "./dto/delete.finished.tasks.usecase.dto.js";

@Injectable()
export class DeleteFinishedTasksUseCase {
    constructor(private readonly management: TaskManagementService) {}

    @Transactional()
    async execute(_input: DeleteFinishedTasksUseCaseIn): Promise<DeleteFinishedTasksUseCaseOut> {
        return this.management.deleteFinished();
    }
}
