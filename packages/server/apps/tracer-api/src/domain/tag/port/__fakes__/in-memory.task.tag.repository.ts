import type { TaskTagEntity } from "@monitor/tracer-domain";
import type { TaskTagRepositoryPort } from "~tracer-api/domain/tag/port/task.tag.repository.port.js";
import { cloneRow } from "./clone-row.js";

/** 태스크·태그 부착 저장소 포트의 인메모리 대역이다. */
export class InMemoryTaskTagRepository implements TaskTagRepositoryPort {
    private rows = new Map<string, TaskTagEntity>();

    seed(...rows: readonly TaskTagEntity[]): void {
        for (const row of rows) this.rows.set(row.id, row);
    }

    all(): TaskTagEntity[] {
        return [...this.rows.values()].map(cloneRow);
    }

    snapshot(): Map<string, TaskTagEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, TaskTagEntity>): void {
        this.rows = snapshot;
    }

    findByTask(userId: string, taskId: string): Promise<TaskTagEntity[]> {
        return Promise.resolve(this.all().filter((row) => row.userId === userId && row.taskId === taskId));
    }

    findByTag(userId: string, tagId: string): Promise<TaskTagEntity[]> {
        return Promise.resolve(this.all().filter((row) => row.userId === userId && row.tagId === tagId));
    }

    findByTasks(userId: string, taskIds: readonly string[]): Promise<TaskTagEntity[]> {
        const idSet = new Set(taskIds);
        return Promise.resolve(this.all().filter((row) => row.userId === userId && idSet.has(row.taskId)));
    }

    countByTag(userId: string): Promise<Record<string, number>> {
        const counts: Record<string, number> = {};
        for (const row of this.all()) {
            if (row.userId !== userId) continue;
            counts[row.tagId] = (counts[row.tagId] ?? 0) + 1;
        }
        return Promise.resolve(counts);
    }

    insertMany(rows: readonly TaskTagEntity[]): Promise<void> {
        for (const row of rows) this.rows.set(row.id, cloneRow(row));
        return Promise.resolve();
    }

    deleteByTaskAndTags(userId: string, taskId: string, tagIds: readonly string[]): Promise<void> {
        const idSet = new Set(tagIds);
        for (const [id, row] of this.rows) {
            if (row.userId === userId && row.taskId === taskId && idSet.has(row.tagId)) this.rows.delete(id);
        }
        return Promise.resolve();
    }

    deleteByTag(userId: string, tagId: string): Promise<void> {
        for (const [id, row] of this.rows) {
            if (row.userId === userId && row.tagId === tagId) this.rows.delete(id);
        }
        return Promise.resolve();
    }
}
