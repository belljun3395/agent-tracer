import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

interface RequestCall {
  readonly endpoint: string;
  readonly body: Record<string, unknown>;
}

const tsxCli = fileURLToPath(new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url));
const userPromptHook = fileURLToPath(new URL("../../../.claude/hooks/user_prompt.ts", import.meta.url));
const sessionStartHook = fileURLToPath(new URL("../../../.claude/hooks/session_start.ts", import.meta.url));
const sessionEndHook = fileURLToPath(new URL("../../../.claude/hooks/session_end.ts", import.meta.url));
const agentActivityHook = fileURLToPath(new URL("../../../.claude/hooks/agent_activity.ts", import.meta.url));
const compactHook = fileURLToPath(new URL("../../../.claude/hooks/compact.ts", import.meta.url));
const subagentLifecycleHook = fileURLToPath(new URL("../../../.claude/hooks/subagent_lifecycle.ts", import.meta.url));
const todoHook = fileURLToPath(new URL("../../../.claude/hooks/todo.ts", import.meta.url));
const toolUsedHook = fileURLToPath(new URL("../../../.claude/hooks/tool_used.ts", import.meta.url));

async function startMonitorStub() {
  const calls: RequestCall[] = [];
  const childRuntimeSessionId = "deadbeef-1234";

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const body = chunks.length > 0
      ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
      : {};
    const endpoint = req.url ?? "";
    calls.push({ endpoint, body });

    res.setHeader("content-type", "application/json");
    if (endpoint === "/api/runtime-session-ensure") {
      const runtimeSessionId = String(body.runtimeSessionId ?? "");
      const isChild = runtimeSessionId === childRuntimeSessionId;
      res.end(JSON.stringify({
        taskId: isChild ? "child-task" : "parent-task",
        sessionId: isChild ? "child-monitor-session" : "parent-monitor-session",
        taskCreated: true,
        sessionCreated: true
      }));
      return;
    }

    res.end(JSON.stringify({ ok: true }));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve stub server port");
  }

  return {
    calls,
    childRuntimeSessionId,
    close: async () => {
      server.close();
      await once(server, "close");
    },
    port: address.port
  };
}

async function runClaudeHook(scriptPath: string, payload: Record<string, unknown>, port: number) {
  const env = {
    ...process.env,
    CLAUDE_PROJECT_DIR: "/repo",
    MONITOR_PORT: String(port)
  };
  delete env.OPENCODE;
  delete env.OPENCODE_CLIENT;

  const child = spawn("node", [tsxCli, scriptPath], {
    env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(JSON.stringify(payload));

  const [code] = await once(child, "close") as [number | null];

  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toBe("");
}

describe("Claude hooks", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      await servers.pop()!.close();
    }
  });

  it("/exit does not emit monitoring events from UserPromptSubmit", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(userPromptHook, {
      prompt: "/exit",
      session_id: "parent-session"
    }, monitor.port);

    expect(monitor.calls).toEqual([]);
  });

  it("SessionStart startup records a session-started planning event", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(sessionStartHook, {
      session_id: "parent-session",
      source: "startup"
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/save-context",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          title: "Session started",
          body: "Claude Code session started.",
          lane: "planning",
          metadata: { trigger: "startup" }
        }
      }
    ]);
  });

  it("SessionStart resume records a session-resumed planning event", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(sessionStartHook, {
      session_id: "parent-session",
      source: "resume"
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/save-context",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          title: "Session resumed",
          body: "Claude Code session resumed.",
          lane: "planning",
          metadata: { trigger: "resume" }
        }
      }
    ]);
  });

  it("SessionEnd with reason clear emits no events (handled by SessionStart clear)", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(sessionEndHook, {
      session_id: "parent-session",
      reason: "clear"
    }, monitor.port);

    expect(monitor.calls).toEqual([]);
  });

  it("SessionEnd hook ends only the runtime session and leaves the task open", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(sessionEndHook, {
      session_id: "parent-session",
      reason: "prompt_input_exit"
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-end",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          summary: "Claude Code session ended (prompt_input_exit)",
          completionReason: "explicit_exit"
        }
      }
    ]);
  });

  it("links background Agent runs through the child runtime session instead of a fabricated task id", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(agentActivityHook, {
      tool_name: "Agent",
      session_id: "parent-session",
      tool_input: {
        description: "Review child monitor flow",
        prompt: "Inspect the child task",
        run_in_background: true,
        subagent_type: "default"
      },
      tool_response: `session_id: ${monitor.childRuntimeSessionId}`
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/agent-activity",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          activityType: "delegation",
          title: "Agent: Review child monitor flow",
          body: "Inspect the child task",
          metadata: {
            toolInput: {
              description: "Review child monitor flow",
              prompt: "Inspect the child task",
              run_in_background: "true",
              subagent_type: "default"
            }
          },
          agentName: "default"
        }
      },
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: monitor.childRuntimeSessionId,
          title: "Review child monitor flow",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/task-link",
        body: {
          taskId: "child-task",
          taskKind: "background",
          parentTaskId: "parent-task",
          parentSessionId: "parent-monitor-session",
          title: "Review child monitor flow"
        }
      }
    ]);
  });

  it("PostCompact records the compact summary as planning context", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(compactHook, {
      hook_event_name: "PostCompact",
      session_id: "parent-session",
      trigger: "manual",
      compact_summary: "Compacted summary"
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/save-context",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          title: "Context compacted",
          body: "Compacted summary",
          lane: "planning",
          metadata: {
            trigger: "manual",
            compactPhase: "after"
          }
        }
      }
    ]);
  });

  it("Subagent lifecycle hook records running and completed async-task events", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(subagentLifecycleHook, {
      hook_event_name: "SubagentStart",
      session_id: "parent-session",
      agent_id: "agent-123",
      agent_type: "Explore"
    }, monitor.port);

    await runClaudeHook(subagentLifecycleHook, {
      hook_event_name: "SubagentStop",
      session_id: "parent-session",
      agent_id: "agent-123",
      agent_type: "Explore",
      last_assistant_message: "Analysis complete."
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/async-task",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          asyncTaskId: "agent-123",
          asyncStatus: "running",
          title: "Subagent started: Explore",
          metadata: {
            agentId: "agent-123",
            agentType: "Explore"
          }
        }
      },
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/async-task",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          asyncTaskId: "agent-123",
          asyncStatus: "completed",
          title: "Subagent finished: Explore",
          body: "Analysis complete.",
          metadata: {
            agentId: "agent-123",
            agentType: "Explore"
          }
        }
      }
    ]);
  });

  it("TaskCreate emits todo lifecycle events for interactive task tools", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(todoHook, {
      tool_name: "TaskCreate",
      session_id: "parent-session",
      tool_input: {
        task_id: "task-123",
        task_subject: "Implement auth",
        status: "in_progress",
        priority: "high"
      }
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/todo",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          todoId: "task-123",
          todoState: "in_progress",
          title: "Implement auth",
          metadata: {
            priority: "high",
            status: "in_progress",
            toolName: "TaskCreate"
          }
        }
      }
    ]);
  });

  it("PostToolUseFailure logs failed Bash commands with failure metadata", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(toolUsedHook, {
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      session_id: "parent-session",
      tool_input: {
        command: "npm test",
        description: "Run tests"
      },
      error: "Command exited with non-zero status code 1",
      is_interrupt: false
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/tool-used",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          toolName: "Bash",
          title: "Failed Bash",
          body: "Command exited with non-zero status code 1",
          lane: "rules",
          metadata: {
            description: "Run tests",
            failed: true,
            error: "Command exited with non-zero status code 1",
            isInterrupt: false
          }
        }
      }
    ]);
  });

  it("records MCP tool usage with parsed server and tool metadata", async () => {
    const monitor = await startMonitorStub();
    servers.push(monitor);

    await runClaudeHook(toolUsedHook, {
      hook_event_name: "PostToolUse",
      tool_name: "mcp__github__search_repositories",
      session_id: "parent-session",
      tool_input: {
        query: "agent tracer"
      }
    }, monitor.port);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "claude-hook",
          runtimeSessionId: "parent-session",
          title: "Claude Code — repo",
          workspacePath: "/repo"
        }
      },
      {
        endpoint: "/api/tool-used",
        body: {
          taskId: "parent-task",
          sessionId: "parent-monitor-session",
          toolName: "mcp__github__search_repositories",
          title: "MCP: github/search_repositories",
          body: "Used MCP tool github/search_repositories",
          lane: "coordination",
          metadata: {
            mcpServer: "github",
            mcpTool: "search_repositories"
          }
        }
      }
    ]);
  });
});
