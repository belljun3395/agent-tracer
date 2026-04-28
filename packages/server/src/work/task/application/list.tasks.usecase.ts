import { Injectable } from "@nestjs/common";
import { TaskQueryService } from "../service/task.query.service.js";
import type { ListTasksUseCaseIn, ListTasksUseCaseOut } from "./dto/list.tasks.usecase.dto.js";

@Injectable()
export class ListTasksUseCase {
    constructor(private readonly query: TaskQueryService) {}

    async execute(_input: ListTasksUseCaseIn): Promise<ListTasksUseCaseOut> {
        return { tasks: await this.query.findAll() };
    }
}
