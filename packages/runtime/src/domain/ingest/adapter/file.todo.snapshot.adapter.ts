import * as path from "node:path";
import {resolveProjectDir} from "~runtime/config/env.js";
import {deleteJsonFile, readJsonFile, writeJsonFile} from "~runtime/support/json.file.store.js";
import type {PersistedTodo} from "~runtime/domain/ingest/model/todo.tool.model.js";
import type {TodoSnapshotPort} from "~runtime/domain/ingest/port/todo.snapshot.port.js";

interface TodoSnapshotFile {
    readonly todos: readonly PersistedTodo[];
}

function isTodoSnapshotFile(value: unknown): value is TodoSnapshotFile {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const todos = (value as Record<string, unknown>)["todos"];
    if (!Array.isArray(todos)) return false;
    return todos.every((item) => {
        if (typeof item !== "object" || item === null) return false;
        const todo = item as Record<string, unknown>;
        return typeof todo["todoId"] === "string"
            && typeof todo["title"] === "string"
            && typeof todo["state"] === "string";
    });
}

/** 할 일 스냅샷을 프로젝트의 `.claude/.todo-state`에 세션별 파일로 둔다. */
export class FileTodoSnapshotAdapter implements TodoSnapshotPort {
    constructor(private readonly projectDir: string = resolveProjectDir()) {}

    load(sessionId: string): readonly PersistedTodo[] {
        return readJsonFile(this.pathOf(sessionId), isTodoSnapshotFile)?.todos ?? [];
    }

    save(sessionId: string, todos: readonly PersistedTodo[]): void {
        writeJsonFile(this.pathOf(sessionId), {todos});
    }

    clear(sessionId: string): void {
        deleteJsonFile(this.pathOf(sessionId));
    }

    private pathOf(sessionId: string): string {
        return path.join(this.projectDir, ".claude", ".todo-state", `${sessionId}.json`);
    }
}
