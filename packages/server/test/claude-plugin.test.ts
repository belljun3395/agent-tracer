import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
interface RequestCall {
    readonly endpoint: string;
    readonly body: Record<string, unknown>;
}
const tsxCli = fileURLToPath(new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url));
const userPromptHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/user_prompt.ts", import.meta.url));
const sessionStartHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/session_start.ts", import.meta.url));
const sessionEndHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/session_end.ts", import.meta.url));
const agentActivityHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/agent_activity.ts", import.meta.url));
const compactHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/compact.ts", import.meta.url));
const subagentLifecycleHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/subagent_lifecycle.ts", import.meta.url));
const todoHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/todo.ts", import.meta.url));
const toolUsedHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/tool_used.ts", import.meta.url));
const terminalHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/terminal.ts", import.meta.url));
const stopHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/stop.ts", import.meta.url));
async function startMonitorStub() {
    const calls: RequestCall[] = [];
    const childRuntimeSessionId = "deadbeef-1234";
    const server = createServer((req, res) => {
        void (async () => {
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
        })().catch((error: unknown) => {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error"
            }));
        });
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
interface RunClaudeHookOptions {
    readonly cwd?: string;
    readonly omitProjectDir?: boolean;
    readonly projectDir?: string;
}
async function runClaudeHook(scriptPath: string, payload: Record<string, unknown>, port: number, options: RunClaudeHookOptions = {}) {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        MONITOR_PORT: String(port)
    };
    if (options.omitProjectDir) {
        delete env.CLAUDE_PROJECT_DIR;
    }
    else {
        env.CLAUDE_PROJECT_DIR = options.projectDir ?? "/repo";
    }
    const child = spawn("node", [tsxCli, scriptPath], {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        ...(options.cwd ? { cwd: options.cwd } : {})
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
    const [code] = await once(child, "close") as [
        number | null
    ];
    expect(code).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toBe("");
}
describe("Claude plugin", () => {
    const servers: Array<{
        close: () => Promise<void>;
    }> = [];
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
    }, 60000);
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
                    runtimeSource: "claude-plugin",
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
    it("SessionStart works without CLAUDE_PROJECT_DIR by falling back to cwd", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
        await runClaudeHook(sessionStartHook, {
            session_id: "parent-session",
            source: "startup"
        }, monitor.port, {
            cwd: repoRoot,
            omitProjectDir: true
        });
        expect(monitor.calls).toEqual([
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "parent-session",
                    title: `Claude Code — ${path.basename(repoRoot)}`,
                    workspacePath: repoRoot
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
                    runtimeSource: "claude-plugin",
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
                    runtimeSource: "claude-plugin",
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
                    runtimeSource: "claude-plugin",
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
                        subtypeKey: "delegation",
                        subtypeLabel: "Delegation",
                        subtypeGroup: "agent",
                        toolFamily: "coordination",
                        operation: "delegate",
                        entityType: "agent",
                        entityName: "default",
                        sourceTool: "Agent",
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
                    runtimeSource: "claude-plugin",
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
                    runtimeSource: "claude-plugin",
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
                    runtimeSource: "claude-plugin",
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
                        agentType: "Explore",
                        parentTaskId: "parent-task",
                        parentSessionId: "parent-session"
                    }
                }
            },
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
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
                        agentType: "Explore",
                        parentTaskId: "parent-task",
                        parentSessionId: "parent-session"
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
                    runtimeSource: "claude-plugin",
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
                    runtimeSource: "claude-plugin",
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
                    lane: "implementation",
                    metadata: {
                        description: "Run tests",
                        subtypeKey: "run_test",
                        subtypeLabel: "Run test",
                        subtypeGroup: "execution",
                        toolFamily: "terminal",
                        operation: "execute",
                        entityType: "command",
                        entityName: "npm",
                        sourceTool: "Bash",
                        failed: true,
                        error: "Command exited with non-zero status code 1",
                        isInterrupt: false
                    }
                }
            }
        ]);
    });
    it("Bash terminal hook records commands on the implementation lane", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(terminalHook, {
            tool_name: "Bash",
            session_id: "parent-session",
            tool_input: {
                command: "npm run lint",
                description: "Run lint"
            }
        }, monitor.port);
        expect(monitor.calls).toEqual([
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "parent-session",
                    title: "Claude Code — repo",
                    workspacePath: "/repo"
                }
            },
            {
                endpoint: "/api/terminal-command",
                body: {
                    taskId: "parent-task",
                    sessionId: "parent-monitor-session",
                    command: "npm run lint",
                    title: "Run lint",
                    body: "Run lint\n\n$ npm run lint",
                    lane: "implementation",
                    metadata: {
                        description: "Run lint",
                        command: "npm run lint",
                        subtypeKey: "run_lint",
                        subtypeLabel: "Run lint",
                        subtypeGroup: "execution",
                        toolFamily: "terminal",
                        operation: "execute",
                        entityType: "command",
                        entityName: "npm",
                        sourceTool: "Bash"
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
                    runtimeSource: "claude-plugin",
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
                    activityType: "mcp_call",
                    title: "MCP: github/search_repositories",
                    body: "Used MCP tool github/search_repositories",
                    lane: "coordination",
                    mcpServer: "github",
                    mcpTool: "search_repositories",
                    metadata: {
                        subtypeKey: "mcp_call",
                        subtypeLabel: "MCP call",
                        subtypeGroup: "external",
                        toolFamily: "coordination",
                        operation: "invoke",
                        entityType: "mcp",
                        entityName: "github/search_repositories",
                        sourceTool: "mcp__github__search_repositories",
                        mcpServer: "github",
                        mcpTool: "search_repositories"
                    }
                }
            }
        ]);
    });
    it("Stop hook: last_assistant_message → assistant-response with full text", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(stopHook, {
            session_id: "parent-session",
            stop_reason: "end_turn",
            last_assistant_message: "I'll fix the bug by editing the file.",
            usage: { input_tokens: 100, output_tokens: 40 }
        }, monitor.port);
        const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
        expect(response).toBeDefined();
        expect(response!.body.source).toBe("claude-plugin");
        expect(response!.body.body).toBe("I'll fix the bug by editing the file.");
        expect(response!.body.title).toBe("I'll fix the bug by editing the file.");
        expect((response!.body.metadata as Record<string, unknown>).stopReason).toBe("end_turn");
        expect((response!.body.metadata as Record<string, unknown>).inputTokens).toBe(100);
        expect((response!.body.metadata as Record<string, unknown>).outputTokens).toBe(40);
        const sessionEnd = monitor.calls.find(c => c.endpoint === "/api/runtime-session-end");
        expect(sessionEnd).toBeUndefined();
    });
    it("Stop hook: last_assistant_message with cache tokens → all token fields populated", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(stopHook, {
            session_id: "parent-session",
            stop_reason: "end_turn",
            last_assistant_message: "The answer is 4.",
            usage: {
                input_tokens: 50,
                output_tokens: 10,
                cache_read_input_tokens: 200,
                cache_creation_input_tokens: 300
            }
        }, monitor.port);
        const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
        expect(response).toBeDefined();
        expect(response!.body.body).toBe("The answer is 4.");
        const meta = response!.body.metadata as Record<string, unknown>;
        expect(meta.cacheReadTokens).toBe(200);
        expect(meta.cacheCreateTokens).toBe(300);
    });
    it("Stop hook: missing last_assistant_message → empty body, fallback title", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(stopHook, {
            session_id: "parent-session",
            stop_reason: "max_turns"
        }, monitor.port);
        const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
        expect(response).toBeDefined();
        expect(response!.body.body).toBeUndefined();
        expect(response!.body.title).toBe("Response (max_turns)");
    });
    it("Stop hook: missing usage → no token metadata fields", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(stopHook, {
            session_id: "parent-session",
            stop_reason: "end_turn",
            last_assistant_message: "Done."
        }, monitor.port);
        const response = monitor.calls.find(c => c.endpoint === "/api/assistant-response");
        expect(response).toBeDefined();
        const meta = response!.body.metadata as Record<string, unknown>;
        expect(meta).not.toHaveProperty("inputTokens");
        expect(meta).not.toHaveProperty("outputTokens");
    });
});
