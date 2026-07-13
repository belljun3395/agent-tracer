import type { TaskEntity } from "@monitor/tracer-domain";
import type { RecipeTaskReaderPort } from "~tracer-api/domain/recipe/port/task.reader.port.js";

/** 태스크 읽기 포트의 인메모리 대역이다. */
export class InMemoryRecipeTaskReader implements RecipeTaskReaderPort {
    private readonly rows = new Map<string, TaskEntity>();
    readonly findByIdsCalls: (readonly string[])[] = [];

    seed(...tasks: readonly TaskEntity[]): void {
        for (const task of tasks) this.rows.set(task.id, task);
    }

    all(): readonly TaskEntity[] {
        return [...this.rows.values()];
    }

    findByIds(ids: readonly string[]): Promise<TaskEntity[]> {
        this.findByIdsCalls.push([...ids]);
        return Promise.resolve(this.all().filter((task) => ids.includes(task.id)));
    }
}
