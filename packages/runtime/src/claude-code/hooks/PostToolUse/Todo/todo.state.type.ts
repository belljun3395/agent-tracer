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

export interface PersistedTodo {
    readonly todoId: string;
    readonly title: string;
    readonly state: string;
}

export interface TodoStateSnapshot {
    readonly todos: readonly PersistedTodo[];
}
