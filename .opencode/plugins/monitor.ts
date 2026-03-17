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
}

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
      const text = output.parts
        .filter((p): p is { type: "text"; text: string } & typeof p => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();

      if (!text) return;

      const phase = state.messageCount === 0 ? "initial" : "follow_up";
      state.messageCount++;

      const title = text.length > 120 ? text.slice(0, 120) + "…" : text;

      await post("/api/user-message", {
        taskId: state.taskId,
        sessionId: state.monitorSessionId,
        messageId: output.message.id,
        captureMode: "raw",
        source: "opencode-plugin",
        phase,
        title,
        body: text,
        metadata: {
          modelId: input.model?.modelID,
          providerId: input.model?.providerID,
          opencodeSessionId: input.sessionID
        }
      });
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        const state = await ensureSessionState({
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
