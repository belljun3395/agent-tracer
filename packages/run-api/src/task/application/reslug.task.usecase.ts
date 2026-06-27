import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskManagementService } from "../service/task.management.service.js";
import type {
    ReslugTaskUseCaseIn,
    ReslugTaskUseCaseOut,
} from "./dto/reslug.task.usecase.dto.js";

@Injectable()
export class ReslugTaskUseCase {
    constructor(private readonly management: TaskManagementService) {}

    @Transactional()
    async execute(input: ReslugTaskUseCaseIn): Promise<ReslugTaskUseCaseOut> {
        const result = await this.management.updateSlug(input.taskId, input.slug);
        if (!result) return { status: "not_found" };
        return { status: "reslugged" };
    }
}
