import {
  createStableTodoId,
  ensureRuntimeSession,
  getSessionId,
  getToolInput,
  hookLog,
  hookLogPayload,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

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

function extractTodoEvents(
  toolName: string,
  toolInput: Record<string, unknown>
): TodoEvent[] {
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
        metadata: {
          priority,
          status,
          toolName
        }
      }];
    });
  }

  if (toolName !== "TaskCreate" && toolName !== "TaskUpdate") {
    return [];
  }

  const taskId = firstString(toolInput, ["task_id", "taskId", "id"]);
  const title = firstString(toolInput, ["task_subject", "subject", "title", "content"]) || taskId;
  if (!title) return [];

  const status = firstString(toolInput, ["status"]) || (toolName === "TaskCreate" ? "pending" : "in_progress");
  const priority = firstString(toolInput, ["priority"]) || "medium";

  return [{
    todoId: taskId || createStableTodoId(title, priority),
    title,
    todoState: STATUS_MAP[status] ?? "added",
    metadata: {
      priority,
      status,
      toolName
    }
  }];
}

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("todo", payload);
  const toolName = toTrimmedString(payload.tool_name);
  const toolInput = getToolInput(payload);
  const sessionId = getSessionId(payload);
  hookLog("todo", "fired", { toolName, sessionId: sessionId || "(none)" });

  if (!sessionId) {
    hookLog("todo", "skipped — no sessionId");
    return;
  }

  const events = extractTodoEvents(toolName, toolInput);
  if (events.length === 0) {
    hookLog("todo", "skipped — no events extracted");
    return;
  }

  const ids = await ensureRuntimeSession(sessionId);
  hookLog("todo", "posting todos", { count: events.length, taskId: ids.taskId });
  for (const event of events) {
    await postJson("/api/todo", {
      taskId: ids.taskId,
      sessionId: ids.sessionId,
      todoId: event.todoId,
      todoState: event.todoState,
      title: event.title,
      metadata: event.metadata
    });
  }
  hookLog("todo", "todos posted", { count: events.length });
}

void main().catch((err: unknown) => {
  hookLog("todo", "ERROR", { error: String(err) });
});
