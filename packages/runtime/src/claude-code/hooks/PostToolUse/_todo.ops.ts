/**
 * Shared logic for task / todo PostToolUse handlers (TaskCreate,
 * TaskUpdate, TodoWrite). Each tool-specific file stays thin.
 */
import {createStableTodoId, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvents} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import type { TodoState } from "~shared/events/kinds.type.js";
import type { TodoLoggedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { LANE } from "~shared/events/lanes.const.js";
import type {PersistedTodo} from "~claude-code/hooks/PostToolUse/Todo/todo.state.type.js";
import {loadTodoState, saveTodoState} from "~claude-code/hooks/PostToolUse/Todo/todo.state.js";

interface TodoEventMetadata {
    readonly toolName?: string;
    readonly priority?: string;
    readonly status?: string;
    readonly autoReconciled?: boolean;
}

interface TodoEvent {
    readonly todoId: string;
    readonly title: string;
    readonly todoState: TodoState;
    readonly metadata: TodoEventMetadata;
}

const STATUS_MAP: Record<string, TodoState> = {
    pending: "added",
    in_progress: "in_progress",
    completed: "completed",
    cancelled: "cancelled",
};

const TERMINAL_STATES = new Set<string>(["completed", "cancelled"]);

function firstString(input: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = toTrimmedString(input[key]);
        if (value) return value;
    }
    return "";
}

function reconcileTodoWrite(
    toolInput: Record<string, unknown>,
    sessionId: string,
): {events: TodoEvent[]; newSnapshot: PersistedTodo[]} {
    const rawTodos = Array.isArray(toolInput["todos"]) ? toolInput["todos"] : [];

    const currentItems: PersistedTodo[] = rawTodos.flatMap((todo) => {
        if (!todo || typeof todo !== "object" || Array.isArray(todo)) return [];
        const entry = todo as Record<string, unknown>;
        const title = toTrimmedString(entry["content"]);
        if (!title) return [];
        const status = toTrimmedString(entry["status"]) || "pending";
        const priority = toTrimmedString(entry["priority"]) || "medium";
        return [{todoId: createStableTodoId(title, priority), title, state: STATUS_MAP[status] ?? "added"}];
    });

    const previousSnapshot = loadTodoState(sessionId);
    const previousByTodoId = new Map<string, PersistedTodo>(
        (previousSnapshot?.todos ?? []).map((t) => [t.todoId, t]),
    );
    const currentIds = new Set(currentItems.map((t) => t.todoId));
    const events: TodoEvent[] = [];

    for (const prev of previousByTodoId.values()) {
        if (!currentIds.has(prev.todoId) && !TERMINAL_STATES.has(prev.state)) {
            events.push({
                todoId: prev.todoId,
                title: prev.title,
                todoState: "cancelled",
                metadata: {priority: "medium", status: "cancelled", toolName: "TodoWrite", autoReconciled: true},
            });
        }
    }

    for (const item of currentItems) {
        const prev = previousByTodoId.get(item.todoId);
        if (!prev || prev.state !== item.state) {
            events.push({
                todoId: item.todoId,
                title: item.title,
                todoState: item.state as TodoState,
                metadata: {priority: "medium", status: item.state, toolName: "TodoWrite"},
            });
        }
    }

    return {events, newSnapshot: currentItems};
}

function extractTodoEvents(
    toolName: string,
    toolInput: Record<string, unknown>,
    sessionId: string,
): {events: TodoEvent[]; newSnapshot: PersistedTodo[] | null} {
    if (toolName === "TodoWrite") {
        const {events, newSnapshot} = reconcileTodoWrite(toolInput, sessionId);
        return {events, newSnapshot};
    }

    if (toolName !== "TaskCreate" && toolName !== "TaskUpdate") {
        return {events: [], newSnapshot: null};
    }

    const taskId = firstString(toolInput, ["task_id", "taskId", "id"]);
    const title = firstString(toolInput, ["task_subject", "subject", "title", "content"]) || taskId;
    if (!title) return {events: [], newSnapshot: null};

    const status = firstString(toolInput, ["status"]) || (toolName === "TaskCreate" ? "pending" : "in_progress");
    const priority = firstString(toolInput, ["priority"]) || "medium";
    return {
        events: [{
            todoId: taskId || createStableTodoId(title, priority),
            title,
            todoState: STATUS_MAP[status] ?? "added",
            metadata: {priority, status, toolName},
        }],
        newSnapshot: null,
    };
}

export async function postTodoEvents({payload, ids}: PostToolUseHandlerArgs): Promise<void> {
    const {events, newSnapshot} = extractTodoEvents(payload.toolName, payload.toolInput, payload.sessionId);
    if (events.length === 0) {
        if (payload.toolName === "TodoWrite" && newSnapshot !== null) {
            saveTodoState(payload.sessionId, {todos: newSnapshot});
        }
        return;
    }

    const evidence = provenEvidence(`Observed directly by the ${payload.toolName} PostToolUse hook.`);
    await postTaggedEvents(events.map((event) => {
        const metadata: TodoLoggedMetadata = {
            ...evidence,
            todoId: event.todoId,
            todoState: event.todoState,
            ...(event.metadata.toolName ? {toolName: event.metadata.toolName} : {}),
            ...(event.metadata.priority ? {priority: event.metadata.priority} : {}),
            ...(event.metadata.status ? {status: event.metadata.status} : {}),
            ...(event.metadata.autoReconciled === true ? {autoReconciled: true} : {}),
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
        };
        return {
            kind: KIND.todoLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.todos,
            title: event.title,
            metadata,
        };
    }));

    if (newSnapshot !== null) {
        saveTodoState(payload.sessionId, {todos: newSnapshot});
    }
}
