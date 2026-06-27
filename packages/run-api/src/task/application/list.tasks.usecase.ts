import { Injectable } from "@nestjs/common";
import { TaskQueryService } from "../service/task.query.service.js";
import type { ListTasksUseCaseIn, ListTasksUseCaseOut } from "./dto/list.tasks.usecase.dto.js";

@Injectable()
export class ListTasksUseCase {
    constructor(private readonly query: TaskQueryService) {}

    async execute(input: ListTasksUseCaseIn): Promise<ListTasksUseCaseOut> {
        const tasks = await this.query.findAll(input.archived ?? "active");
        const originFilter = input.origin ?? "all";
        if (originFilter === "all") return { tasks };
        // Default to "user" for legacy rows where origin was never set so the
        // tasks view doesn't silently lose them after the schema migration.
        const filtered = tasks.filter((t) => (t.origin ?? "user") === originFilter);
        return { tasks: filtered };
    }
}
