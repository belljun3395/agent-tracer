/**
 * Per-session todo list state for TodoWrite reconciliation.
 *
 * Stores the last-known todo list so PostToolUse/Todo can emit explicit
 * "cancelled" transitions for items removed from the list, and detect
 * state changes without relying on a stable hash across content edits.
 *
 * Location: `<PROJECT_DIR>/.claude/.todo-state/<sessionId>.json`
 * Deleted by SessionEnd (same lifecycle as the transcript cursor).
 */
import * as path from "node:path";
import { PROJECT_DIR } from "../util/paths.js";
import { deleteJsonFile, readJsonFile, writeJsonFile } from "./json-file-store.js";

const TODO_STATE_DIR = `${PROJECT_DIR}/.claude/.todo-state`;

export interface PersistedTodo {
    readonly todoId: string;
    readonly title: string;
    readonly state: string;
}

export interface TodoStateSnapshot {
    readonly todos: readonly PersistedTodo[];
}

function isTodoStateSnapshot(value: unknown): value is TodoStateSnapshot {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v["todos"])) return false;
    return (v["todos"] as unknown[]).every((item) => {
        if (typeof item !== "object" || item === null) return false;
        const t = item as Record<string, unknown>;
        return typeof t["todoId"] === "string" && typeof t["title"] === "string" && typeof t["state"] === "string";
    });
}

function statePath(sessionId: string): string {
    return path.join(TODO_STATE_DIR, `${sessionId}.json`);
}

export function loadTodoState(sessionId: string): TodoStateSnapshot | null {
    return readJsonFile(statePath(sessionId), isTodoStateSnapshot);
}

export function saveTodoState(sessionId: string, snapshot: TodoStateSnapshot): void {
    writeJsonFile(statePath(sessionId), snapshot);
}

export function deleteTodoState(sessionId: string): void {
    deleteJsonFile(statePath(sessionId));
}
