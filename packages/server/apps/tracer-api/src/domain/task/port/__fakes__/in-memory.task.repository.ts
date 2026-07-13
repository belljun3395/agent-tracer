import type { TaskEntity, TaskPageFilter } from "@monitor/tracer-domain";
import type { TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";

/** 태스크 저장소 포트의 인메모리 대역이다. */
export class InMemoryTaskRepository implements TaskRepositoryPort {
    private readonly rows = new Map<string, TaskEntity>();
    lastPageFilter: TaskPageFilter | null = null;

    seed(...tasks: readonly TaskEntity[]): void {
        for (const task of tasks) this.rows.set(task.id, task);
    }

    all(): readonly TaskEntity[] {
        return [...this.rows.values()];
    }

    findById(id: string): Promise<TaskEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findChildren(taskId: string): Promise<TaskEntity[]> {
        return Promise.resolve(this.all().filter((task) => task.parentTaskId === taskId));
    }

    findPage(userId: string, filter: TaskPageFilter): Promise<TaskEntity[]> {
        this.lastPageFilter = filter;
        const rows = this.all()
            .filter((task) => task.userId === userId)
            .filter((task) => filter.parentTaskId === undefined || task.parentTaskId === filter.parentTaskId)
            .filter((task) => filter.status === undefined || task.status === filter.status)
            .filter((task) => filter.origin === undefined || task.origin === filter.origin)
            .filter((task) => filter.rootOnly !== true || task.parentTaskId === null);
        return Promise.resolve(rows.slice(0, filter.limit));
    }

    upsert(task: TaskEntity): Promise<void> {
        this.rows.set(task.id, task);
        return Promise.resolve();
    }
}
