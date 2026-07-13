import type { SearchOutboxEntity, TaskEntity, TaskUserStateEntity } from "@monitor/tracer-domain";
import type {
    CleanupSearchOutboxWriterPort,
    CleanupTaskReaderPort,
    CleanupTaskUserStateWriterPort,
    CleanupTransactionPort,
    CleanupTx,
} from "~tracer-api/domain/cleanup/port/cleanup.transaction.port.js";
import { InMemoryCleanupSuggestionRepository } from "./in-memory.cleanup.suggestion.repository.js";
import { cloneRow } from "./clone-row.js";

/** 정리 제안 수락이 읽는 태스크의 인메모리 대역이다. */
export class InMemoryCleanupTaskReader implements CleanupTaskReaderPort {
    private readonly rows = new Map<string, TaskEntity>();

    seed(...tasks: readonly TaskEntity[]): void {
        for (const task of tasks) this.rows.set(task.id, task);
    }

    findById(id: string): Promise<TaskEntity | null> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? null : cloneRow(row));
    }
}

/** 태스크 사용자 상태 쓰기의 인메모리 대역이며, 저장 실패를 주입할 수 있다. */
export class InMemoryCleanupTaskUserStateWriter implements CleanupTaskUserStateWriterPort {
    private rows = new Map<string, TaskUserStateEntity>();
    saveFailure: Error | null = null;

    seed(...states: readonly TaskUserStateEntity[]): void {
        for (const state of states) this.rows.set(state.taskId, state);
    }

    all(): readonly TaskUserStateEntity[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, TaskUserStateEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, TaskUserStateEntity>): void {
        this.rows = snapshot;
    }

    findById(taskId: string): Promise<TaskUserStateEntity | null> {
        const row = this.rows.get(taskId);
        return Promise.resolve(row === undefined ? null : cloneRow(row));
    }

    save(state: TaskUserStateEntity): Promise<void> {
        if (this.saveFailure !== null) return Promise.reject(this.saveFailure);
        this.rows.set(state.taskId, state);
        return Promise.resolve();
    }
}

/** 검색 아웃박스 적재의 인메모리 대역이다. */
export class InMemoryCleanupSearchOutbox implements CleanupSearchOutboxWriterPort {
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
export class InMemoryCleanupTransaction implements CleanupTransactionPort {
    readonly cleanupSuggestions = new InMemoryCleanupSuggestionRepository();
    readonly tasks = new InMemoryCleanupTaskReader();
    readonly taskUserStates = new InMemoryCleanupTaskUserStateWriter();
    readonly searchOutbox = new InMemoryCleanupSearchOutbox();

    async run<T>(work: (tx: CleanupTx) => Promise<T>): Promise<T> {
        const suggestions = this.cleanupSuggestions.snapshot();
        const states = this.taskUserStates.snapshot();
        const outbox = this.searchOutbox.snapshot();
        try {
            return await work(this);
        } catch (error) {
            this.cleanupSuggestions.restore(suggestions);
            this.taskUserStates.restore(states);
            this.searchOutbox.restore(outbox);
            throw error;
        }
    }
}
