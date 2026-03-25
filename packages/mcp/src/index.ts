/**
 * @module index
 *
 * Agent Tracer MCP stdio 서버.
 * 에이전트(Claude, OpenCode, Codex)가 호출할 수 있는 24개 모니터링 도구 제공.
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
  // monitor_complete_task, monitor_task_error, monitor_runtime_session_ensure,
  // monitor_runtime_session_end

  server.registerTool(
    "monitor_task_start",
    {
      title: "Monitor Task Start",
      description: "Record the start of a monitored agent task.",
      inputSchema: {
        taskId: z.string().optional(),
        title: z.string(),
        workspacePath: z.string().optional(),
        runtimeSource: z.string().optional(),
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
    "monitor_task_link",
    {
      title: "Monitor Task Link",
      description:
        "Link an already-started task into parent/background lineage. " +
        "Use this when a runtime discovers subagent or background relationships after task creation.",
      inputSchema: {
        taskId: z.string(),
        title: z.string().optional(),
        taskKind: z.enum(["primary", "background"]).optional(),
        parentTaskId: z.string().optional(),
        parentSessionId: z.string().optional(),
        backgroundTaskId: z.string().optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/task-link", input))
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

  server.registerTool(
    "monitor_runtime_session_ensure",
    {
      title: "Monitor Runtime Session Ensure",
      description:
        "Create or resume a runtime-scoped monitor task/session using runtimeSource + runtimeSessionId. " +
        "Use this when the runtime can keep a stable thread/session identity across turns.",
      inputSchema: {
        runtimeSource: z.string(),
        runtimeSessionId: z.string(),
        title: z.string(),
        workspacePath: z.string().optional(),
        parentTaskId: z.string().optional(),
        parentSessionId: z.string().optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/runtime-session-ensure", input))
  );

  server.registerTool(
    "monitor_runtime_session_end",
    {
      title: "Monitor Runtime Session End",
      description:
        "End a runtime-scoped monitor session. " +
        "Use completeTask=true only when the whole work item should be completed, otherwise leave it unset to preserve the task across turns.",
      inputSchema: {
        runtimeSource: z.string(),
        runtimeSessionId: z.string(),
        summary: z.string().optional(),
        completeTask: z.boolean().optional(),
        completionReason: z.enum(["idle", "assistant_turn_complete", "explicit_exit", "runtime_terminated"]).optional(),
        backgroundCompletions: z.array(z.string()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/runtime-session-end", input))
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
      description: "Record a terminal command executed during a task. Use lane='implementation' for commands.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        command: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        lane: z.enum(["implementation"]).optional(),
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
        lane: z.enum(["user", "exploration", "planning", "implementation"]).optional(),
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

  server.registerTool(
    "monitor_question",
    {
      title: "Monitor Question",
      description:
        "Record a question flow event. " +
        "Use phase='asked' when the agent poses a question to the user, " +
        "'answered' when a user answer is received, " +
        "'concluded' when the agent draws a conclusion (routes to planning lane). " +
        "Use the same questionId for all phases of one question.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        questionId: z.string(),
        questionPhase: z.enum(["asked", "answered", "concluded"]),
        sequence: z.number().int().nonnegative().optional(),
        title: z.string(),
        body: z.string().optional(),
        modelName: z.string().optional(),
        modelProvider: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/question", input))
  );

  server.registerTool(
    "monitor_todo",
    {
      title: "Monitor Todo",
      description:
        "Record a todo item lifecycle transition. " +
        "Use state='added' when first created, 'in_progress' when started, " +
        "'completed' or 'cancelled' when finished. " +
        "Use the same todoId for all transitions of one todo item.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        todoId: z.string(),
        todoState: z.enum(["added", "in_progress", "completed", "cancelled"]),
        sequence: z.number().int().nonnegative().optional(),
        title: z.string(),
        body: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/todo", input))
  );

  server.registerTool(
    "monitor_thought",
    {
      title: "Monitor Thought",
      description:
        "Record a summarized reasoning step in the planning lane. " +
        "Use for summary-safe thoughts only — do NOT dump raw chain-of-thought. " +
        "Include modelName/modelProvider when model identity is known.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        title: z.string(),
        body: z.string().optional(),
        modelName: z.string().optional(),
        modelProvider: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/thought", input))
  );

  server.registerTool(
    "monitor_agent_activity",
    {
      title: "Monitor Agent Activity",
      description:
        "Record coordination-lane activity such as MCP calls, skill usage, delegation, handoff, search, and bookmarks. " +
        "Use this when you want the dashboard to explain how agent support actions shaped the work.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        activityType: z.enum(["agent_step", "mcp_call", "skill_use", "delegation", "handoff", "bookmark", "search"]),
        title: z.string().optional(),
        body: z.string().optional(),
        agentName: z.string().optional(),
        skillName: z.string().optional(),
        skillPath: z.string().optional(),
        mcpServer: z.string().optional(),
        mcpTool: z.string().optional(),
        parentEventId: z.string().optional(),
        relatedEventIds: z.array(z.string()).optional(),
        workItemId: z.string().optional(),
        goalId: z.string().optional(),
        planId: z.string().optional(),
        handoffId: z.string().optional(),
        relationType: z.enum([
          "implements",
          "revises",
          "verifies",
          "answers",
          "delegates",
          "returns",
          "completes",
          "blocks",
          "caused_by",
          "relates_to"
        ]).optional(),
        relationLabel: z.string().optional(),
        relationExplanation: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/agent-activity", input))
  );

  // ─── Canonical Conversation Events & Session End ─────────────────────────────
  // monitor_user_message, monitor_assistant_response, monitor_session_end

  server.registerTool(
    "monitor_user_message",
    {
      title: "Monitor User Message",
      description:
        "Record a canonical user.message event (contractVersion 1). " +
        "Use captureMode='raw' for actual user prompt text. " +
        "Use captureMode='derived' for inferred/enriched records — sourceEventId is required. " +
        "All callers must provide sessionId. " +
        "If raw prompt text is unavailable, use monitor_rule with ruleId='user-message-capture-unavailable' instead.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string(),
        messageId: z.string(),
        captureMode: z.enum(["raw", "derived"]),
        source: z.string(),
        phase: z.enum(["initial", "follow_up"]).optional(),
        title: z.string(),
        body: z.string().optional(),
        sourceEventId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        contractVersion: z.string().optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/user-message", input))
  );

  server.registerTool(
    "monitor_assistant_response",
    {
      title: "Monitor Assistant Response",
      description:
        "Record the assistant's user-facing response as a canonical assistant.response event. " +
        "Call this immediately before sending the final answer when the runtime has no native response hook.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        messageId: z.string(),
        source: z.string(),
        title: z.string(),
        body: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/assistant-response", input))
  );

  server.registerTool(
    "monitor_session_end",
    {
      title: "Monitor Session End",
      description:
        "End the current runtime session without completing the work item. " +
        "The task remains running; the work item accumulates messages across multiple sessions. " +
        "Use monitor_task_complete to explicitly close the work item when all work is done. " +
        "Claude hooks should keep completeTask unset; OpenCode primary session shutdown may choose explicit completion through its adapter policy.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/session-end", input))
  );

  // ─── Workflow Library ─────────────────────────────────────────────────────────
  // monitor_evaluate_task, monitor_find_similar_workflows

  server.registerTool(
    "monitor_evaluate_task",
    {
      title: "Monitor Evaluate Task",
      description:
        "Mark a completed task as a workflow example for future reference. " +
        "Use rating='good' for tasks where the approach worked well and should be referenced later. " +
        "Use rating='skip' to exclude a task from future suggestions. " +
        "The outcomeNote is the most valuable field — describe what approach worked and why.",
      inputSchema: {
        taskId: z.string(),
        rating: z.enum(["good", "skip"]),
        useCase: z.string().optional().describe("What kind of task was this? e.g. 'TypeScript type error fixes'"),
        workflowTags: z.array(z.string()).optional().describe("e.g. ['typescript', 'bug-fix', 'refactor']"),
        outcomeNote: z.string().optional().describe("What approach worked well? Hints for next time.")
      }
    },
    async ({ taskId, ...rest }) => toToolResponse(await client.post(`/api/tasks/${taskId}/evaluate`, rest))
  );

  server.registerTool(
    "monitor_find_similar_workflows",
    {
      title: "Monitor Find Similar Workflows",
      description:
        "Search past workflow examples to find how similar tasks were handled. " +
        "Call this at the start of a new task to get hints from past similar work. " +
        "Returns workflow summaries including what was done and what approach worked.",
      inputSchema: {
        description: z.string().describe("Describe the current task to search for similar past work"),
        tags: z.array(z.string()).optional().describe("Filter by tags e.g. ['typescript', 'refactor']"),
        limit: z.number().int().min(1).max(10).optional().default(3)
      }
    },
    async ({ description, tags, limit }) => {
      const params = new URLSearchParams({ q: description, limit: String(limit ?? 3) });
      if (tags && tags.length > 0) params.set("tags", tags.join(","));
      const result = await client.get(`/api/workflows/similar?${params.toString()}`);
      if (!result.ok || !Array.isArray(result.data)) {
        return toToolResponse(result);
      }
      // Format results as readable text for the AI
      const items = result.data as Array<{
        taskId: string; title: string; rating: string; useCase: string | null;
        workflowTags: string[]; outcomeNote: string | null; eventCount: number;
        workflowContext: string;
      }>;
      if (items.length === 0) {
        return { content: [{ type: "text" as const, text: "No similar past workflows found." }], structuredContent: result };
      }
      const text = items.map((item, i) => [
        `--- [${i + 1}] ${item.title} (${item.rating})`,
        item.useCase ? `Use case: ${item.useCase}` : null,
        item.workflowTags.length > 0 ? `Tags: ${item.workflowTags.join(", ")}` : null,
        item.outcomeNote ? `Hint: ${item.outcomeNote}` : null,
        "",
        item.workflowContext
      ].filter(Boolean).join("\n")).join("\n\n");
      return { content: [{ type: "text" as const, text }], structuredContent: result };
    }
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
