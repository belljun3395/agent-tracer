import type { TaskUserStateEntity } from "@monitor/tracer-domain";
import type { TaskUserStateRepositoryPort } from "~tracer-api/domain/task/port/task.user.state.repository.port.js";

/** 태스크 사용자 상태 포트의 인메모리 대역이다. */
export class InMemoryTaskUserStateRepository implements TaskUserStateRepositoryPort {
    private readonly rows = new Map<string, TaskUserStateEntity>();

    seed(...states: readonly TaskUserStateEntity[]): void {
        for (const state of states) this.rows.set(state.taskId, state);
    }

    all(): readonly TaskUserStateEntity[] {
        return [...this.rows.values()];
    }

    findById(taskId: string): Promise<TaskUserStateEntity | null> {
        return Promise.resolve(this.rows.get(taskId) ?? null);
    }

    save(state: TaskUserStateEntity): Promise<void> {
        this.rows.set(state.taskId, state);
        return Promise.resolve();
    }
}
