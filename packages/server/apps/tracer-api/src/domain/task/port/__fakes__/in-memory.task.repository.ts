import { TaskView, type TaskEntity, type TaskPageFilter, type TaskUserStateEntity } from "@monitor/tracer-domain";
import type { TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";

/** 태스크 저장소 포트의 인메모리 대역이다. */
export class InMemoryTaskRepository implements TaskRepositoryPort {
    private readonly rows = new Map<string, TaskEntity>();
    private readonly userStates = new Map<string, TaskUserStateEntity>();
    lastPageFilter: TaskPageFilter | null = null;
    visiblePageQueryCount = 0;

    seed(...tasks: readonly TaskEntity[]): void {
        for (const task of tasks) this.rows.set(task.id, task);
    }

    seedUserStates(...states: readonly TaskUserStateEntity[]): void {
        for (const state of states) this.userStates.set(state.taskId, state);
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

    findVisiblePage(userId: string, filter: TaskPageFilter): Promise<TaskView[]> {
        this.lastPageFilter = filter;
        this.visiblePageQueryCount += 1;
        const rows = this.all()
            .filter((task) => task.userId === userId)
            .filter((task) => filter.parentTaskId === undefined || task.parentTaskId === filter.parentTaskId)
            .filter((task) => filter.status === undefined || task.status === filter.status)
            .filter((task) => filter.origin === undefined || task.origin === filter.origin)
            .filter((task) => filter.rootOnly !== true || task.parentTaskId === null)
            .filter(
                (task) =>
                    filter.cursor === undefined ||
                    task.updatedAt.toISOString() < filter.cursor.updatedAt ||
                    (task.updatedAt.toISOString() === filter.cursor.updatedAt && task.id < filter.cursor.id),
            )
            .map((task) => {
                const candidate = this.userStates.get(task.id);
                const state = candidate?.userId === userId ? candidate : null;
                return { task, state, view: new TaskView(task, state) };
            })
            .filter(({ view }) => view.isVisible())
            .filter(({ view }) => filter.archived === undefined || view.isArchived() === filter.archived)
            .sort((a, b) => b.task.updatedAt.getTime() - a.task.updatedAt.getTime() || b.task.id.localeCompare(a.task.id))
            .slice(0, filter.limit)
            .map(({ view }) => view);
        return Promise.resolve(rows);
    }

    upsert(task: TaskEntity): Promise<void> {
        this.rows.set(task.id, task);
        return Promise.resolve();
    }
}
