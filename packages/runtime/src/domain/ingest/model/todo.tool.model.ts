import {
    KIND,
    LANE,
    provenEvidence,
    turnOf,
    type IngestTarget,
    type RuntimeIngestEvent,
    type TodoState,
} from "~runtime/domain/ingest/model/event.model.js";
import {
    toolUseIdOf,
    type ShapedToolEvent,
    type ToolCall,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import type {TodoLoggedMetadata} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import {stableTodoId} from "~runtime/support/hash.js";
import {toTrimmedString} from "~runtime/support/text.js";

export const TODO_TOOLS = ["TodoWrite", "TaskCreate", "TaskUpdate"] as const;

const STATUS_MAP: Record<string, TodoState> = {
    pending: "added",
    in_progress: "in_progress",
    completed: "completed",
    cancelled: "cancelled",
};

const TERMINAL_STATES: ReadonlySet<string> = new Set(["completed", "cancelled"]);

/** 세션마다 남겨 다음 TodoWrite와 대조하는 할 일 스냅샷이다. */
export interface PersistedTodo {
    readonly todoId: string;
    readonly title: string;
    readonly state: string;
}

/** 조형 결과와 다음 대조에 쓸 새 스냅샷이다. */
export interface ShapedTodoEvents {
    readonly events: readonly ShapedToolEvent[];
    readonly snapshot: readonly PersistedTodo[] | null;
}

/** 할 일 도구를 전이 이벤트로 조형하고 사라진 항목은 취소로 재조정한다. */
export function shapeTodoEvents(call: ToolCall, previous: readonly PersistedTodo[]): ShapedTodoEvents {
    if (call.toolName === "TodoWrite") return shapeTodoWrite(call, previous);
    if (call.toolName === "TaskCreate" || call.toolName === "TaskUpdate") {
        return {events: shapeTaskTool(call), snapshot: null};
    }
    return {events: [], snapshot: null};
}

/** 도구 호출이 아니라 태스크 수명주기 훅이 보고하는 할 일 전이다. */
export interface TodoLifecycleInput {
    readonly taskName: string;
    readonly todoState: TodoState;
    readonly source: string;
    readonly status: string;
    readonly body?: string;
}

export function todoLifecycleEvent(
    target: IngestTarget,
    input: TodoLifecycleInput,
): RuntimeIngestEvent {
    const metadata: TodoLoggedMetadata = {
        ...provenEvidence(`Emitted by the ${input.source} hook.`),
        todoId: stableTodoId(input.taskName, "medium"),
        todoState: input.todoState,
        toolName: input.source,
        status: input.status,
    };
    return {
        kind: KIND.todoLogged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.todos,
        title: input.taskName,
        ...(input.body ? {body: input.body} : {}),
        metadata,
    };
}

function shapeTodoWrite(call: ToolCall, previous: readonly PersistedTodo[]): ShapedTodoEvents {
    const rawTodos = Array.isArray(call.toolInput["todos"]) ? call.toolInput["todos"] : [];
    const current: PersistedTodo[] = rawTodos.flatMap((todo) => {
        if (typeof todo !== "object" || todo === null || Array.isArray(todo)) return [];
        const entry = todo as Record<string, unknown>;
        const title = toTrimmedString(entry["content"]);
        if (!title) return [];
        const status = toTrimmedString(entry["status"]) || "pending";
        const priority = toTrimmedString(entry["priority"]) || "medium";
        return [{todoId: stableTodoId(title, priority), title, state: STATUS_MAP[status] ?? "added"}];
    });

    const currentIds = new Set(current.map((todo) => todo.todoId));
    const previousById = new Map(previous.map((todo) => [todo.todoId, todo]));
    const events: ShapedToolEvent[] = [];

    for (const stale of previousById.values()) {
        if (currentIds.has(stale.todoId) || TERMINAL_STATES.has(stale.state)) continue;
        events.push(todoEvent(call, stale.todoId, stale.title, "cancelled", {
            priority: "medium",
            status: "cancelled",
            autoReconciled: true,
        }));
    }

    for (const todo of current) {
        const before = previousById.get(todo.todoId);
        if (before && before.state === todo.state) continue;
        events.push(todoEvent(call, todo.todoId, todo.title, todo.state as TodoState, {
            priority: "medium",
            status: todo.state,
        }));
    }

    return {events, snapshot: current};
}

function shapeTaskTool(call: ToolCall): readonly ShapedToolEvent[] {
    const taskId = firstString(call.toolInput, ["task_id", "taskId", "id"]);
    const title = firstString(call.toolInput, ["task_subject", "subject", "title", "content"]) || taskId;
    if (!title) return [];
    const status = firstString(call.toolInput, ["status"])
        || (call.toolName === "TaskCreate" ? "pending" : "in_progress");
    const priority = firstString(call.toolInput, ["priority"]) || "medium";
    return [todoEvent(
        call,
        taskId || stableTodoId(title, priority),
        title,
        STATUS_MAP[status] ?? "added",
        {priority, status},
    )];
}

function todoEvent(
    call: ToolCall,
    todoId: string,
    title: string,
    todoState: TodoState,
    extras: {priority: string; status: string; autoReconciled?: boolean},
): ShapedToolEvent {
    const metadata: TodoLoggedMetadata = {
        ...provenEvidence(`Observed directly by the ${call.toolName} PostToolUse hook.`),
        todoId,
        todoState,
        toolName: call.toolName,
        priority: extras.priority,
        status: extras.status,
        ...(extras.autoReconciled === true ? {autoReconciled: true} : {}),
        ...toolUseIdOf(call),
    };
    return {kind: KIND.todoLogged, lane: LANE.todos, title, metadata};
}

function firstString(input: Record<string, unknown>, keys: readonly string[]): string {
    for (const key of keys) {
        const value = toTrimmedString(input[key]);
        if (value) return value;
    }
    return "";
}
