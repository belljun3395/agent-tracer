import type { TaskEntity } from "@monitor/tracer-domain";
import type { TaskReaperTaskRepository } from "~projector/domain/recover/port/task.reaper.repository.port.js";

/** 태스크 회수 저장소 포트의 인메모리 대역이다. */
export class InMemoryTaskReaperRepository implements TaskReaperTaskRepository {
    private readonly rows: TaskEntity[] = [];
    readonly upserted: string[] = [];

    seed(...tasks: readonly TaskEntity[]): void {
        this.rows.push(...tasks);
    }

    findReapableChildren(before: Date, limit: number): Promise<TaskEntity[]> {
        const stale = this.rows.filter(
            (task) =>
                task.parentTaskId !== null &&
                task.lastEventAt !== null &&
                task.lastEventAt.getTime() < before.getTime(),
        );
        return Promise.resolve(stale.slice(0, limit));
    }

    upsert(task: TaskEntity): Promise<void> {
        this.upserted.push(task.id);
        return Promise.resolve();
    }
}
