import type { SearchOutboxEntity } from "@monitor/tracer-domain";
import type {
    MemoSearchOutboxWriterPort,
    MemoTransactionPort,
    MemoTx,
} from "~tracer-api/domain/memo/port/memo.transaction.port.js";
import { InMemoryMemoRepository } from "./in-memory.memo.repository.js";
import { cloneRow } from "./clone-row.js";

/** 검색 아웃박스 적재의 인메모리 대역이다. */
export class InMemoryMemoSearchOutbox implements MemoSearchOutboxWriterPort {
    private rows = new Map<string, SearchOutboxEntity>();

    all(): readonly SearchOutboxEntity[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, SearchOutboxEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, SearchOutboxEntity>): void {
        this.rows = snapshot;
    }

    enqueue(row: SearchOutboxEntity): Promise<void> {
        this.rows.set(row.id, row);
        return Promise.resolve();
    }
}

/** 인메모리 대역 위에서 트랜잭션 경계를 재현해 실패 시 참여 저장소를 진입 시점으로 되돌린다. */
export class InMemoryMemoTransaction implements MemoTransactionPort {
    readonly memos = new InMemoryMemoRepository();
    readonly searchOutbox = new InMemoryMemoSearchOutbox();

    async run<T>(work: (tx: MemoTx) => Promise<T>): Promise<T> {
        const memos = this.memos.snapshot();
        const outbox = this.searchOutbox.snapshot();
        try {
            return await work(this);
        } catch (error) {
            this.memos.restore(memos);
            this.searchOutbox.restore(outbox);
            throw error;
        }
    }
}
