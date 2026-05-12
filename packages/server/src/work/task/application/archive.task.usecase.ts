import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
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
        if (result.status === "archived") {
            return {
                status: result.status,
                archivedIds: result.archivedIds,
                archivedAt: result.archivedAt,
            };
        }
        return { status: result.status };
    }
}
