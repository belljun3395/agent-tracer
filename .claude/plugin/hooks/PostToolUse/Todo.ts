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
 * This handler extracts individual todo events from the tool payload and posts
 * each one to /api/todo in the Agent Tracer monitor.
 */
import { createStableTodoId, getAgentContext, getSessionId, getToolInput, getToolName, getToolUseId, toTrimmedString } from "../util/utils.js";
import { postJson, readStdinJson } from "../lib/transport.js";
import { resolveEventSessionIds } from "../lib/subagent-session.js";
import { hookLog, hookLogPayload } from "../lib/hook-log.js";

type TodoState = "added" | "in_progress" | "completed" | "cancelled";

interface TodoEvent {
    readonly todoId: string;
    readonly title: string;
    readonly todoState: TodoState;
    readonly metadata: Record<string, unknown>;
}

const STATUS_MAP: Record<string, TodoState> = {
    pending: "added",
    in_progress: "in_progress",
    completed: "completed",
    cancelled: "cancelled"
};

function firstString(input: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = toTrimmedString(input[key]);
        if (value) return value;
    }
    return "";
}

function extractTodoEvents(toolName: string, toolInput: Record<string, unknown>): TodoEvent[] {
    if (toolName === "TodoWrite" && Array.isArray(toolInput.todos)) {
        return toolInput.todos.flatMap((todo) => {
            if (!todo || typeof todo !== "object" || Array.isArray(todo)) return [];
            const entry = todo as Record<string, unknown>;
            const title = toTrimmedString(entry.content);
            if (!title) return [];
            const status = toTrimmedString(entry.status) || "pending";
            const priority = toTrimmedString(entry.priority) || "medium";
            return [{
                todoId: createStableTodoId(title, priority),
                title,
                todoState: STATUS_MAP[status] ?? "added",
                metadata: { priority, status, toolName }
            }];
        });
    }

    if (toolName !== "TaskCreate" && toolName !== "TaskUpdate") return [];

    const taskId = firstString(toolInput, ["task_id", "taskId", "id"]);
    const title = firstString(toolInput, ["task_subject", "subject", "title", "content"]) || taskId;
    if (!title) return [];

    const status = firstString(toolInput, ["status"]) || (toolName === "TaskCreate" ? "pending" : "in_progress");
    const priority = firstString(toolInput, ["priority"]) || "medium";
    return [{
        todoId: taskId || createStableTodoId(title, priority),
        title,
        todoState: STATUS_MAP[status] ?? "added",
        metadata: { priority, status, toolName }
    }];
}

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUse/Todo", payload);
    const toolName = getToolName(payload);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    const { agentId, agentType } = getAgentContext(payload);
    hookLog("PostToolUse/Todo", "fired", { toolName, sessionId: sessionId || "(none)" });

    if (!sessionId) {
        hookLog("PostToolUse/Todo", "skipped — no sessionId");
        return;
    }

    const events = extractTodoEvents(toolName, toolInput);
    if (events.length === 0) {
        hookLog("PostToolUse/Todo", "skipped — no events extracted");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const toolUseId = getToolUseId(payload);
    hookLog("PostToolUse/Todo", "posting todos", { count: events.length, taskId: ids.taskId });

    await postJson("/ingest/v1/events", {
        events: events.map((event) => ({
            kind: "todo.logged",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            todoId: event.todoId,
            todoState: event.todoState,
            title: event.title,
            metadata: {
                ...event.metadata,
                ...(toolUseId ? { toolUseId } : {})
            }
        }))
    });
    hookLog("PostToolUse/Todo", "todos posted", { count: events.length });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Todo", "ERROR", { error: String(err) });
});
