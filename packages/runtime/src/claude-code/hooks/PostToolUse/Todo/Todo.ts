/**
 * Claude Code Hook: PostToolUse — matcher: "TaskCreate|TaskUpdate|TodoWrite"
 *
 * Fires after any task management or todo-write tool succeeds.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — "TaskCreate" | "TaskUpdate" | "TodoWrite"
 *   tool_input       object  — tool-specific input (see below)
 *   tool_response    any     — tool result (not used here)
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * TaskCreate tool_input fields:
 *   task_subject     string  — task title
 *   task_description string? — full description
 *
 * TaskUpdate tool_input fields:
 *   task_id          string  — task identifier
 *   status           string  — new status (e.g. "in_progress", "completed")
 *
 * TodoWrite tool_input fields:
 *   todos            array   — array of todo items:
 *     content        string  — todo text
 *     status         string  — "pending" | "in_progress" | "completed" | "cancelled"
 *     priority       string  — "low" | "medium" | "high"
 *
 * Blocking: PostToolUse cannot block (exit 2 shows stderr but execution continues).
 *
 * For TodoWrite: reconciles the new list against the previously stored list to
 * emit explicit "cancelled" transitions for items removed from the list.
 */
import {createStableTodoId, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvents} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {KIND, type TodoState} from "~shared/events/kinds.js";
import {type TodoLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

import {LANE} from "~shared/events/lanes.js";
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
    cancelled: "cancelled"
};

const TERMINAL_STATES = new Set<string>(["completed", "cancelled"]);

function firstString(input: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = toTrimmedString(input[key]);
        if (value) return value;
    }
    return "";
}

/**
 * Builds the current todo events from a TodoWrite payload and reconciles
 * with the previous snapshot to emit cancellations for removed items.
 */
function reconcileTodoWrite(
    toolInput: Record<string, unknown>,
    sessionId: string
): { events: TodoEvent[]; newSnapshot: PersistedTodo[] } {
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
        (previousSnapshot?.todos ?? []).map((t) => [t.todoId, t])
    );
    const currentIds = new Set(currentItems.map((t) => t.todoId));

    const events: TodoEvent[] = [];

    // Emit cancellations for items removed from the list (only if not already terminal)
    for (const prev of previousByTodoId.values()) {
        if (!currentIds.has(prev.todoId) && !TERMINAL_STATES.has(prev.state)) {
            events.push({
                todoId: prev.todoId,
                title: prev.title,
                todoState: "cancelled",
                metadata: {priority: "medium", status: "cancelled", toolName: "TodoWrite", autoReconciled: true}
            });
        }
    }

    // Emit current items — only if the state changed or the item is new
    for (const item of currentItems) {
        const prev = previousByTodoId.get(item.todoId);
        if (!prev || prev.state !== item.state) {
            events.push({
                todoId: item.todoId,
                title: item.title,
                todoState: item.state as TodoState,
                metadata: {priority: "medium", status: item.state, toolName: "TodoWrite"}
            });
        }
    }

    return {events, newSnapshot: currentItems};
}

function extractTodoEvents(
    toolName: string,
    toolInput: Record<string, unknown>,
    sessionId: string
): { events: TodoEvent[]; newSnapshot: PersistedTodo[] | null } {
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
            metadata: {priority, status, toolName}
        }],
        newSnapshot: null
    };
}

async function main(): Promise<void> {
    const {
        sessionId,
        agentId,
        agentType,
        toolName,
        toolInput,
        toolUseId
    } = await readToolHookContext("PostToolUse/Todo");
    hookLog("PostToolUse/Todo", "fired", {toolName, sessionId: sessionId || "(none)"});

    if (!sessionId) {
        hookLog("PostToolUse/Todo", "skipped — no sessionId");
        return;
    }

    const {events, newSnapshot} = extractTodoEvents(toolName, toolInput, sessionId);
    if (events.length === 0) {
        // Still persist empty snapshot if it's a TodoWrite clearing the list
        if (toolName === "TodoWrite" && newSnapshot !== null) {
            saveTodoState(sessionId, {todos: newSnapshot});
        }
        hookLog("PostToolUse/Todo", "skipped — no events extracted");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    hookLog("PostToolUse/Todo", "posting todos", {count: events.length, taskId: ids.taskId});

    const evidence = provenEvidence("Observed directly by the TodoWrite PostToolUse hook.");
    await postTaggedEvents(events.map((event): {
        kind: typeof KIND.todoLogged;
        taskId: string;
        sessionId: string;
        lane: "todos";
        title: string;
        metadata: TodoLoggedMetadata
    } => {
        const baseTodoMeta: TodoLoggedMetadata = {
            ...evidence,
            todoId: event.todoId,
            todoState: event.todoState,
            ...(event.metadata.toolName ? {toolName: event.metadata.toolName} : {}),
            ...(event.metadata.priority ? {priority: event.metadata.priority} : {}),
            ...(event.metadata.status ? {status: event.metadata.status} : {}),
            ...(event.metadata.autoReconciled === true ? {autoReconciled: true} : {}),
            ...(toolUseId ? {toolUseId} : {}),
        };
        return {
            kind: KIND.todoLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.todos,
            title: event.title,
            metadata: baseTodoMeta,
        };
    }));
    hookLog("PostToolUse/Todo", "todos posted", {count: events.length});

    // Persist new snapshot after successful post
    if (newSnapshot !== null) {
        saveTodoState(sessionId, {todos: newSnapshot});
    }
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Todo", "ERROR", {error: String(err)});
});
