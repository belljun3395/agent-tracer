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
import {PROJECT_DIR} from "~claude-code/hooks/util/paths.const.js";
import type {TodoStateSnapshot} from "~claude-code/hooks/PostToolUse/Todo/todo.state.type.js";
import {deleteJsonFile, readJsonFile, writeJsonFile} from "~claude-code/hooks/util/json-file.store.js";

const TODO_STATE_DIR = `${PROJECT_DIR}/.claude/.todo-state`;

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

/**
 * Reads the persisted todo list snapshot for the session from disk, validates
 * its shape, and returns it. Returns `null` if the file does not exist or fails
 * validation.
 */
export function loadTodoState(sessionId: string): TodoStateSnapshot | null {
    return readJsonFile(statePath(sessionId), isTodoStateSnapshot);
}

/**
 * Writes the todo list snapshot to the session's state file, creating directories
 * if needed. Used to persist the previous state before reconciliation.
 */
export function saveTodoState(sessionId: string, snapshot: TodoStateSnapshot): void {
    writeJsonFile(statePath(sessionId), snapshot);
}

/**
 * Removes the todo state file for the session. Silently succeeds if the file
 * does not exist.
 */
export function deleteTodoState(sessionId: string): void {
    deleteJsonFile(statePath(sessionId));
}
