/**
 * @module index
 *
 * Agent Tracer MCP stdio 서버.
 * 에이전트(Claude, OpenCode, Codex)가 호출할 수 있는 14개 모니터링 도구 제공.
 * 직접 실행 시(`node dist/index.js`) stdio MCP 서버로 시작.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { MonitorClient } from "./client.js";
import { toToolResponse } from "./result.js";

/**
 * 모니터링 도구가 등록된 MCP 서버 인스턴스를 생성한다.
 * 테스트에서는 커스텀 `client`를 주입할 수 있다.
 *
 * @param client - HTTP 클라이언트 (기본값: `new MonitorClient()`)
 * @returns 도구가 등록된 {@link McpServer} 인스턴스
 */
export function createMonitorMcpServer(client = new MonitorClient()): McpServer {
  const server = new McpServer({
    name: "monitor-server",
    version: "0.1.0"
  });

  // ─── Task Lifecycle ──────────────────────────────────────────────────────────
  // monitor_task_start, monitor_start_task, monitor_task_complete,
  // monitor_complete_task, monitor_task_error

  server.registerTool(
    "monitor_task_start",
    {
      title: "Monitor Task Start",
      description: "Record the start of a monitored agent task.",
      inputSchema: {
        taskId: z.string().optional(),
        title: z.string(),
        workspacePath: z.string().optional(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/task-start", input))
  );

  server.registerTool(
    "monitor_start_task",
    {
      title: "Monitor Start Task",
      description: "Article-aligned alias for recording the start of a monitored agent task.",
      inputSchema: {
        taskId: z.string().optional(),
        title: z.string(),
        workspacePath: z.string().optional(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/task-start", input))
  );

  server.registerTool(
    "monitor_task_complete",
    {
      title: "Monitor Task Complete",
      description: "Mark a monitored task as completed.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/task-complete", input))
  );

  server.registerTool(
    "monitor_complete_task",
    {
      title: "Monitor Complete Task",
      description: "Article-aligned alias for marking a monitored task as completed.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/task-complete", input))
  );

  server.registerTool(
    "monitor_task_error",
    {
      title: "Monitor Task Error",
      description: "Record a monitored task failure without interrupting the agent.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        errorMessage: z.string(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/task-error", input))
  );

  // ─── Async Lifecycle ─────────────────────────────────────────────────────────
  // monitor_async_task

  server.registerTool(
    "monitor_async_task",
    {
      title: "Monitor Async Task",
      description: "Record OpenCode-style background task lifecycle events.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        asyncTaskId: z.string(),
        asyncStatus: z.enum(["pending", "running", "completed", "error", "cancelled", "interrupt"]),
        title: z.string().optional(),
        body: z.string().optional(),
        description: z.string().optional(),
        agent: z.string().optional(),
        category: z.string().optional(),
        parentSessionId: z.string().optional(),
        durationMs: z.number().nonnegative().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/async-task", input))
  );

  // ─── Event Logging ───────────────────────────────────────────────────────────
  // monitor_tool_used, monitor_terminal_command, monitor_save_context,
  // monitor_plan, monitor_action, monitor_verify, monitor_rule, monitor_explore

  server.registerTool(
    "monitor_tool_used",
    {
      title: "Monitor Tool Used",
      description: "Record tool usage during a task.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        toolName: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/tool-used", input))
  );

  server.registerTool(
    "monitor_terminal_command",
    {
      title: "Monitor Terminal Command",
      description: "Record a terminal command executed during a task. Use lane='rules' for tests/builds/lints, 'implementation' for regular commands.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        command: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        lane: z.enum(["implementation", "rules"]).optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/terminal-command", input))
  );

  server.registerTool(
    "monitor_save_context",
    {
      title: "Monitor Save Context",
      description: "Record a planning thought, analysis, or context snapshot. Use lane='planning' for thoughts/plans, 'user' for user-facing messages.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        title: z.string(),
        body: z.string().optional(),
        lane: z.enum(["user", "exploration", "planning", "implementation", "rules"]).optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/save-context", input))
  );

  server.registerTool(
    "monitor_plan",
    {
      title: "Monitor Plan",
      description: "Record a planning step or approach decision using a free-form snake_case action name.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        action: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/plan", input))
  );

  server.registerTool(
    "monitor_action",
    {
      title: "Monitor Action",
      description: "Record an agent action before execution using a free-form snake_case action name.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        action: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/action", input))
  );

  server.registerTool(
    "monitor_verify",
    {
      title: "Monitor Verify",
      description: "Record a verification step such as tests, build, or lint with a structured result.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        action: z.string(),
        result: z.string(),
        status: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/verify", input))
  );

  server.registerTool(
    "monitor_rule",
    {
      title: "Monitor Rule",
      description: "Record a rule-related event such as a check, violation, or fix with rule metadata.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        action: z.string(),
        ruleId: z.string(),
        severity: z.string(),
        status: z.string(),
        source: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/rule", input))
  );

  server.registerTool(
    "monitor_explore",
    {
      title: "Monitor Explore",
      description: "Record an exploration action: file read, code search, dependency check, or documentation lookup.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        toolName: z.string(),
        title: z.string(),
        body: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/explore", input))
  );

  return server;
}

/**
 * stdio 트랜스포트로 MCP 서버를 시작한다.
 * 에이전트 런타임이 이 함수를 직접 호출하거나 `node dist/index.js`로 실행한다.
 */
export async function startMonitorMcpServer(): Promise<void> {
  const server = createMonitorMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  await startMonitorMcpServer();
}
