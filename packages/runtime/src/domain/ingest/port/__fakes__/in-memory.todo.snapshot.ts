import type {PersistedTodo} from "~runtime/domain/ingest/model/todo.tool.model.js";
import type {TodoSnapshotPort} from "~runtime/domain/ingest/port/todo.snapshot.port.js";

export class InMemoryTodoSnapshot implements TodoSnapshotPort {
    private readonly bySession = new Map<string, readonly PersistedTodo[]>();

    load(sessionId: string): readonly PersistedTodo[] {
        return this.bySession.get(sessionId) ?? [];
    }

    save(sessionId: string, todos: readonly PersistedTodo[]): void {
        this.bySession.set(sessionId, todos);
    }

    clear(sessionId: string): void {
        this.bySession.delete(sessionId);
    }
}
