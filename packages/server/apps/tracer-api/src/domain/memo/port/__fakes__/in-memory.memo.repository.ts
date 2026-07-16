import type { MemoEntity } from "@monitor/tracer-domain";
import type { MemoRepositoryPort } from "~tracer-api/domain/memo/port/memo.repository.port.js";
import { cloneRow } from "./clone-row.js";

/** 메모 저장소 포트의 인메모리 대역이다. */
export class InMemoryMemoRepository implements MemoRepositoryPort {
    private rows = new Map<string, MemoEntity>();

    seed(...memos: readonly MemoEntity[]): void {
        for (const memo of memos) this.rows.set(memo.id, memo);
    }

    all(): MemoEntity[] {
        return [...this.rows.values()].map(cloneRow);
    }

    snapshot(): Map<string, MemoEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, MemoEntity>): void {
        this.rows = snapshot;
    }

    findById(id: string): Promise<MemoEntity | null> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? null : cloneRow(row));
    }

    findByTask(userId: string, taskId: string): Promise<MemoEntity[]> {
        return Promise.resolve(this.all().filter(
            (memo) => memo.userId === userId && memo.taskId === taskId && memo.deletedAt === null,
        ));
    }

    findByEvent(eventId: string): Promise<MemoEntity[]> {
        return Promise.resolve(this.all().filter((memo) => memo.eventId === eventId && memo.deletedAt === null));
    }

    listAll(userId: string): Promise<MemoEntity[]> {
        return Promise.resolve(this.all().filter((memo) => memo.userId === userId && memo.deletedAt === null));
    }

    upsert(memo: MemoEntity): Promise<void> {
        this.rows.set(memo.id, cloneRow(memo));
        return Promise.resolve();
    }
}
