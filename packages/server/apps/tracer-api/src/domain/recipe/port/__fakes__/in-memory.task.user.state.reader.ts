import type { TaskUserStateEntity } from "@monitor/tracer-domain";
import type { RecipeTaskUserStateReaderPort } from "~tracer-api/domain/recipe/port/task.user.state.reader.port.js";

/** 태스크 사용자 상태 읽기 포트의 인메모리 대역이다. */
export class InMemoryRecipeTaskUserStateReader implements RecipeTaskUserStateReaderPort {
    private readonly rows = new Map<string, TaskUserStateEntity>();

    seed(...states: readonly TaskUserStateEntity[]): void {
        for (const state of states) this.rows.set(state.taskId, state);
    }

    all(): readonly TaskUserStateEntity[] {
        return [...this.rows.values()];
    }

    findByIds(taskIds: readonly string[]): Promise<TaskUserStateEntity[]> {
        return Promise.resolve(this.all().filter((state) => taskIds.includes(state.taskId)));
    }
}
