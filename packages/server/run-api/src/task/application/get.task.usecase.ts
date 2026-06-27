import { Injectable } from "@nestjs/common";
import { TaskReadService } from "../service/task.read.service.js";
import type { GetTaskUseCaseIn, GetTaskUseCaseOut } from "./dto/get.task.usecase.dto.js";

@Injectable()
export class GetTaskUseCase {
    constructor(private readonly query: TaskReadService) {}

    async execute(input: GetTaskUseCaseIn): Promise<GetTaskUseCaseOut> {
        return { task: await this.query.findById(input.taskId) };
    }
}
