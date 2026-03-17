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
import type { Plugin } from "@opencode-ai/plugin";

const BASE_URL = process.env.MONITOR_BASE_URL?.replace(/\/+$/, "")
  ?? `http://127.0.0.1:${process.env.MONITOR_PORT ?? "3847"}`;

/** 현재 세션의 태스크 ID (session.created 시 설정, session.deleted 시 초기화) */
let currentTaskId: string | undefined;
/** 현재 세션 ID */
let currentSessionId: string | undefined;

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

export const MonitorPlugin: Plugin = async ({ project }) => {
  const workspacePath = project?.path ?? process.cwd();

  return {
    /** 세션 시작: 새 모니터링 태스크 생성 */
    "session.created": async () => {
      const workspaceName = workspacePath.split("/").pop() ?? "opencode";
      const result = await post("/api/task-start", {
        title: `OpenCode - ${workspaceName}`,
        workspacePath
      }) as { task?: { id: string }; sessionId?: string } | null;

      currentTaskId = result?.task?.id;
      currentSessionId = result?.sessionId;
    },

    /** 도구 실행 후: 도구 종류에 따라 이벤트 기록 */
    "tool.execute.after": async ({ tool, input, output }: { tool: { name?: string }; input: Record<string, unknown>; output: unknown }) => {
      if (!currentTaskId) return;

      const toolName = tool?.name ?? "unknown";
      const { endpoint, lane } = classifyTool(toolName);

      const body: Record<string, unknown> = {
        taskId: currentTaskId,
        sessionId: currentSessionId,
        toolName,
        title: toolName,
        body: typeof output === "string" ? output.slice(0, 500) : undefined,
        ...(lane ? { lane } : {})
      };

      // explore 엔드포인트는 toolName 필드 필요
      if (endpoint === "/api/explore") {
        await post(endpoint, body);
      } else if (endpoint === "/api/terminal-command") {
        await post(endpoint, {
          ...body,
          command: typeof input?.command === "string" ? input.command : toolName
        });
      } else {
        await post(endpoint, body);
      }
    },

    /** 세션 종료: 태스크 완료 처리 */
    "session.deleted": async () => {
      if (!currentTaskId) return;

      await post("/api/task-complete", {
        taskId: currentTaskId,
        sessionId: currentSessionId,
        summary: "OpenCode session ended"
      });

      // 다음 세션을 위해 상태 초기화
      currentTaskId = undefined;
      currentSessionId = undefined;
    }
  };
};
