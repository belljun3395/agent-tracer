import type {PersistedTodo} from "~runtime/domain/ingest/model/todo.tool.model.js";

/** 세션별 할 일 스냅샷을 훅 호출 사이에 보관한다. */
export interface TodoSnapshotPort {
    load(sessionId: string): readonly PersistedTodo[];
    save(sessionId: string, todos: readonly PersistedTodo[]): void;
    clear(sessionId: string): void;
}
