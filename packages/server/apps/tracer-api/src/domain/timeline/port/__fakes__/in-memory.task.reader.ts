import type { TaskEntity } from "@monitor/tracer-domain";
import type { TimelineTaskReaderPort } from "../task.reader.port.js";

/** 태스크 읽기 포트의 인메모리 대역이다. */
export class InMemoryTimelineTaskReader implements TimelineTaskReaderPort {
    private readonly rows = new Map<string, TaskEntity>();

    seed(...tasks: readonly TaskEntity[]): void {
        for (const task of tasks) this.rows.set(task.id, task);
    }

    all(): readonly TaskEntity[] {
        return [...this.rows.values()];
    }

    findById(id: string): Promise<TaskEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }
}
