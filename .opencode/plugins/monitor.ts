/**
 * @module .opencode/plugins/monitor
 *
 * OpenCode용 Agent Tracer 자동 모니터링 플러그인.
 *
 * 세션 시작 시 태스크를 생성하고, 모든 도구 사용을 자동으로 기록.
 * 세션 종료 시 태스크를 완료 처리.
 *
 * 환경변수:
 *   MONITOR_PORT  - 서버 포트 (기본값: 3847)
 *   MONITOR_BASE_URL - 전체 서버 URL (지정 시 MONITOR_PORT 대신 사용)
 */
import type { Hooks, Plugin } from "@opencode-ai/plugin";

const BASE_URL = process.env.MONITOR_BASE_URL?.replace(/\/+$/, "")
  ?? `http://127.0.0.1:${process.env.MONITOR_PORT ?? "3847"}`;

interface SessionState {
  readonly taskId: string;
  readonly monitorSessionId?: string;
  messageCount: number; // mutable: tracks user messages for phase detection
  todoStateById: Map<string, "added" | "in_progress" | "completed" | "cancelled">;
}

type MonitorSemanticRoute = {
  endpoint: "/api/question" | "/api/todo" | "/api/thought";
  body: Record<string, unknown>;
};

type TaskStartResult = {
  readonly task?: { id: string };
  readonly sessionId?: string;
};

const sessionStates = new Map<string, SessionState>();
const pendingSessionStarts = new Map<string, Promise<SessionState | undefined>>();

/**
 * JSON POST 헬퍼. 오류 시 조용히 무시 (에이전트 동작 방해하지 않음).
 */
async function post(endpoint: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null; // 서버 미가용 시 조용히 무시
  }
}

/**
 * 도구명을 분석하여 적절한 모니터링 엔드포인트와 레인을 결정.
 * @param toolName OpenCode가 실행한 도구 이름
 */
function classifyTool(toolName: string): { endpoint: string; lane?: string } {
  const lower = toolName.toLowerCase();

  if (isTodoWriteTool(lower)) {
    return { endpoint: "/api/todo", lane: "todos" };
  }

  if (/read|glob|grep|search|fetch|find|list/.test(lower)) {
    return { endpoint: "/api/explore" };
  }

  if (/edit|write|create|patch|apply/.test(lower)) {
    return { endpoint: "/api/tool-used", lane: "implementation" };
  }

  if (/bash|shell|run|exec|terminal/.test(lower)) {
    // test/build/lint 패턴이면 rules 레인
    const isVerification = /test|build|lint|vitest|pytest|tsc/.test(lower);
    return { endpoint: "/api/terminal-command", lane: isVerification ? "rules" : "implementation" };
  }

  return { endpoint: "/api/tool-used", lane: "implementation" };
}

function normalizeTodoState(
  status: unknown
): "added" | "in_progress" | "completed" | "cancelled" {
  const normalized = String(status ?? "").toLowerCase().trim();
  if (normalized === "in_progress") return "in_progress";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled") return "cancelled";
  return "added";
}

function isTodoWriteTool(lowerToolName: string): boolean {
  return lowerToolName === "todowrite"
    || lowerToolName.endsWith(".todowrite")
    || lowerToolName.endsWith("/todowrite");
}

function isMonitorQuestionTool(lowerToolName: string): boolean {
  return lowerToolName.endsWith("monitor_question")
    || lowerToolName.endsWith("monitor_monitor_question");
}

function isMonitorTodoTool(lowerToolName: string): boolean {
  return lowerToolName.endsWith("monitor_todo")
    || lowerToolName.endsWith("monitor_monitor_todo");
}

function isMonitorThoughtTool(lowerToolName: string): boolean {
  return lowerToolName.endsWith("monitor_thought")
    || lowerToolName.endsWith("monitor_monitor_thought");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseQuestionPhase(value: unknown): "asked" | "answered" | "concluded" | undefined {
  const normalized = toNonEmptyString(value);
  if (!normalized) return undefined;
  if (normalized === "asked" || normalized === "answered" || normalized === "concluded") {
    return normalized;
  }
  return undefined;
}

function buildSemanticRoute(input: {
  toolName: string;
  args: unknown;
  state: SessionState;
  opencodeSessionId: string;
  opencodeCallId?: string;
  outputTitle?: string;
}): MonitorSemanticRoute | undefined {
  const lower = input.toolName.toLowerCase();
  const args = asObject(input.args);
  const metadata = {
    ...(asObject(args.metadata)),
    opencodeSessionId: input.opencodeSessionId,
    ...(input.opencodeCallId ? { opencodeCallId: input.opencodeCallId } : {})
  };

  if (isMonitorQuestionTool(lower)) {
    const questionId = toNonEmptyString(args.questionId);
    const questionPhase = parseQuestionPhase(args.questionPhase);
    const title = toNonEmptyString(args.title) ?? toNonEmptyString(input.outputTitle);
    if (!questionId || !questionPhase || !title) return undefined;
    return {
      endpoint: "/api/question",
      body: {
        taskId: input.state.taskId,
        sessionId: input.state.monitorSessionId,
        questionId,
        questionPhase,
        ...(typeof args.sequence === "number" ? { sequence: args.sequence } : {}),
        title,
        ...(toNonEmptyString(args.body) ? { body: toNonEmptyString(args.body) } : {}),
        ...(toNonEmptyString(args.modelName) ? { modelName: toNonEmptyString(args.modelName) } : {}),
        ...(toNonEmptyString(args.modelProvider) ? { modelProvider: toNonEmptyString(args.modelProvider) } : {}),
        metadata
      }
    };
  }

  if (isMonitorTodoTool(lower)) {
    const todoId = toNonEmptyString(args.todoId);
    const title = toNonEmptyString(args.title) ?? toNonEmptyString(input.outputTitle);
    if (!todoId || !title) return undefined;
    return {
      endpoint: "/api/todo",
      body: {
        taskId: input.state.taskId,
        sessionId: input.state.monitorSessionId,
        todoId,
        todoState: normalizeTodoState(args.todoState),
        ...(typeof args.sequence === "number" ? { sequence: args.sequence } : {}),
        title,
        ...(toNonEmptyString(args.body) ? { body: toNonEmptyString(args.body) } : {}),
        metadata
      }
    };
  }

  if (isMonitorThoughtTool(lower)) {
    const title = toNonEmptyString(args.title) ?? toNonEmptyString(input.outputTitle);
    if (!title) return undefined;
    return {
      endpoint: "/api/thought",
      body: {
        taskId: input.state.taskId,
        sessionId: input.state.monitorSessionId,
        title,
        ...(toNonEmptyString(args.body) ? { body: toNonEmptyString(args.body) } : {}),
        ...(toNonEmptyString(args.modelName) ? { modelName: toNonEmptyString(args.modelName) } : {}),
        ...(toNonEmptyString(args.modelProvider) ? { modelProvider: toNonEmptyString(args.modelProvider) } : {}),
        metadata
      }
    };
  }

  return undefined;
}

function toTodoId(todo: Record<string, unknown>): string {
  const content = String(todo.content ?? "").trim();
  const priority = String(todo.priority ?? "").trim();
  return `${content}::${priority}`;
}

function extractTextFromParts(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      const type = String(record.type ?? "").toLowerCase();
      if (typeof record.text === "string") return record.text;
      if (type === "input_text" && typeof record.content === "string") return record.content;
      return "";
    })
    .join("\n")
    .trim();
}

function deriveUserMessageFields(text: string): { title: string; body: string } {
  const body = text.trim();
  const sanitizedLines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => line !== "<system-reminder>" && line !== "</system-reminder>")
    .filter((line) => !line.startsWith("[BACKGROUND TASK COMPLETED]"))
    .filter((line) => !line.startsWith("[ALL BACKGROUND TASKS COMPLETE]"));

  const preferred = sanitizedLines[0] ?? body;
  const title = preferred.length > 120 ? `${preferred.slice(0, 120)}…` : preferred;
  return { title, body };
}

async function logTodoTransitions(input: {
  state: SessionState;
  opencodeSessionId: string;
  todos: readonly unknown[];
}): Promise<void> {
  const nextById = new Map<string, "added" | "in_progress" | "completed" | "cancelled">();

  for (const item of input.todos) {
    if (!item || typeof item !== "object") continue;
    const todo = item as Record<string, unknown>;
    const title = String(todo.content ?? "").trim();
    if (!title) continue;

    const todoId = toTodoId(todo);
    const nextState = normalizeTodoState(todo.status);
    nextById.set(todoId, nextState);

    const prevState = input.state.todoStateById.get(todoId);
    if (prevState === nextState) continue;

    await post("/api/todo", {
      taskId: input.state.taskId,
      sessionId: input.state.monitorSessionId,
      todoId,
      todoState: nextState,
      title,
      metadata: {
        opencodeSessionId: input.opencodeSessionId
      }
    });
  }

  input.state.todoStateById = nextById;
}

export function createMonitorHooks(workspacePath: string): Hooks {

  function buildTaskTitle(targetWorkspacePath: string, sessionId: string): string {
    const workspaceName = targetWorkspacePath.split("/").pop() ?? "opencode";
    return `OpenCode - ${workspaceName} (${sessionId.slice(0, 8)})`;
  }

  async function ensureSessionState(input: {
    sessionId: string;
    directory?: string;
    title?: string;
  }): Promise<SessionState | undefined> {
    const existing = sessionStates.get(input.sessionId);
    if (existing) return existing;

    const pending = pendingSessionStarts.get(input.sessionId);
    if (pending) return pending;

    const targetWorkspacePath = input.directory ?? workspacePath;
    const promise = (async (): Promise<SessionState | undefined> => {
      const result = await post("/api/task-start", {
        title: buildTaskTitle(targetWorkspacePath, input.sessionId),
        workspacePath: targetWorkspacePath,
        metadata: {
          opencodeSessionId: input.sessionId,
          ...(input.title ? { opencodeSessionTitle: input.title } : {})
        }
      }) as TaskStartResult | null;

      const taskId = result?.task?.id;
      if (!taskId) return undefined;

      const nextState: SessionState = {
        taskId,
        messageCount: 0,
        todoStateById: new Map(),
        ...(result?.sessionId ? { monitorSessionId: result.sessionId } : {})
      };
      sessionStates.set(input.sessionId, nextState);
      return nextState;
    })();

    pendingSessionStarts.set(input.sessionId, promise);

    try {
      return await promise;
    } finally {
      pendingSessionStarts.delete(input.sessionId);
    }
  }

  return {
    "chat.message": async (input, output) => {
      const state = await ensureSessionState({ sessionId: input.sessionID });
      if (!state) return;

      // Extract text from TextPart items
      const text = extractTextFromParts(output.parts);

      if (!text) return;

      const message = deriveUserMessageFields(text);

      const phase = state.messageCount === 0 ? "initial" : "follow_up";
      state.messageCount++;

      await post("/api/user-message", {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        messageId: output.message.id,
        captureMode: "raw",
        source: "opencode-plugin",
        phase,
        title: message.title,
        body: message.body,
        metadata: {
          modelId: input.model?.modelID,
          providerId: input.model?.providerID,
          opencodeSessionId: input.sessionID
        }
      });
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        await ensureSessionState({
          sessionId: event.properties.info.id,
          directory: event.properties.info.directory,
          title: event.properties.info.title
        });

        return;
      }

      if (event.type !== "session.deleted") return;

      const opencodeSessionId = event.properties.info.id;
      const state = sessionStates.get(opencodeSessionId)
        ?? await pendingSessionStarts.get(opencodeSessionId)
        ?? undefined;

      if (!state) return;

      // 세션만 종료 — 태스크는 running 상태를 유지한다.
      // task-complete 는 명시적인 작업 완료 경로에서만 호출해야 한다.
      await post("/api/session-end", {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        summary: "OpenCode session ended",
        metadata: {
          opencodeSessionId
        }
      });

      sessionStates.delete(opencodeSessionId);
      pendingSessionStarts.delete(opencodeSessionId);
    },

    "tool.execute.before": async (input) => {
      await ensureSessionState({ sessionId: input.sessionID });
    },

    "tool.execute.after": async (input, output) => {
      const state = sessionStates.get(input.sessionID)
        ?? await pendingSessionStarts.get(input.sessionID)
        ?? undefined;
      if (!state) return;

      const toolName = typeof input.tool === "string" ? input.tool : "unknown";

      if (isTodoWriteTool(toolName.toLowerCase())) {
        const todos = Array.isArray(input.args?.todos)
          ? input.args.todos as unknown[]
          : [];
        if (todos.length > 0) {
          await logTodoTransitions({
            state,
            opencodeSessionId: input.sessionID,
            todos
          });
        }
        return;
      }

      const semanticRoute = buildSemanticRoute({
        toolName,
        args: input.args,
        state,
        opencodeSessionId: input.sessionID,
        opencodeCallId: input.callID,
        outputTitle: output.title
      });
      if (semanticRoute) {
        await post(semanticRoute.endpoint, semanticRoute.body);
        return;
      }

      const { endpoint, lane } = classifyTool(toolName);

      const body: Record<string, unknown> = {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        toolName,
        title: output.title || toolName,
        body: typeof output.output === "string" ? output.output.slice(0, 500) : undefined,
        metadata: {
          opencodeSessionId: input.sessionID,
          opencodeCallId: input.callID
        },
        ...(lane ? { lane } : {})
      };

      if (endpoint === "/api/explore") {
        await post(endpoint, body);
      } else if (endpoint === "/api/terminal-command") {
        await post(endpoint, {
          ...body,
          command: typeof input.args?.command === "string" ? input.args.command : toolName
        });
      } else {
        await post(endpoint, body);
      }
    }
  };
}

export const MonitorPlugin: Plugin = async ({ directory }) => createMonitorHooks(directory || process.cwd());
