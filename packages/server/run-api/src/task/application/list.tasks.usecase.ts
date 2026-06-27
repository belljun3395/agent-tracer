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

        // origin이 비어 있으면 사용자 태스크로 간주해 목록에서 누락되지 않게 한다.
        const filtered = tasks.filter((t) => (t.origin ?? "user") === originFilter);
        return { tasks: filtered };
    }
}
