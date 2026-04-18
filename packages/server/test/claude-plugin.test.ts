import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
interface RequestCall {
    readonly endpoint: string;
    readonly body: Record<string, unknown>;
}
const tsxCli = fileURLToPath(new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url));
const userPromptHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/UserPromptSubmit.ts", import.meta.url));
const sessionStartHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/SessionStart.ts", import.meta.url));
const sessionEndHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/SessionEnd.ts", import.meta.url));
const agentActivityHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostToolUse/Agent.ts", import.meta.url));
const fileToolHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostToolUse/File.ts", import.meta.url));
const compactHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostCompact.ts", import.meta.url));
const subagentLifecycleHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/SubagentStart.ts", import.meta.url));
const subagentStopHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/SubagentStop.ts", import.meta.url));
const todoHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostToolUse/Todo.ts", import.meta.url));
const toolUsedHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostToolUseFailure.ts", import.meta.url));
const mcpHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostToolUse/Mcp.ts", import.meta.url));
const terminalHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/PostToolUse/Bash.ts", import.meta.url));
const stopHook = fileURLToPath(new URL("../../../.claude/plugin/hooks/Stop.ts", import.meta.url));
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

async function startStatefulMonitorStub() {
    const calls: RequestCall[] = [];
    const taskIds = new Map<string, string>();
    const bindings = new Map<string, string>();
    let nextTaskIndex = 1;
    let nextSessionIndex = 1;

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
                if (!taskIds.has(runtimeSessionId)) {
                    taskIds.set(runtimeSessionId, `task-${nextTaskIndex++}`);
                }
                if (!bindings.has(runtimeSessionId)) {
                    bindings.set(runtimeSessionId, `monitor-session-${nextSessionIndex++}`);
                }
                res.end(JSON.stringify({
                    taskId: taskIds.get(runtimeSessionId),
                    sessionId: bindings.get(runtimeSessionId),
                    taskCreated: false,
                    sessionCreated: true
                }));
                return;
            }

            if (endpoint === "/api/runtime-session-end") {
                const runtimeSessionId = String(body.runtimeSessionId ?? "");
                bindings.delete(runtimeSessionId);
                res.end(JSON.stringify({ ok: true }));
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

function extractEmbeddedSessionIds(payload: Record<string, unknown>): string[] {
    const sessionIds = new Set<string>();
    const runtimeSessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";
    if (runtimeSessionId) sessionIds.add(runtimeSessionId);

    const agentId = typeof payload.agent_id === "string" ? payload.agent_id.trim() : "";
    if (agentId) sessionIds.add(`sub--${agentId}`);

    const toolResponse = payload.tool_response;
    const toolResponseText = typeof toolResponse === "string"
        ? toolResponse
        : JSON.stringify(toolResponse ?? {});
    const childMatch = /session_id[:\s]+([a-f0-9-]{8,})/i.exec(toolResponseText);
    if (childMatch?.[1]) sessionIds.add(childMatch[1].trim());

    return [...sessionIds];
}

function cleanupHookState(projectDir: string, payload: Record<string, unknown>): void {
    const sessionCacheDir = path.join(projectDir, ".claude", ".session-cache");
    for (const sessionId of extractEmbeddedSessionIds(payload)) {
        for (const suffix of [".json", "-metadata.json", "-transcript-cursor.json"]) {
            try {
                fs.unlinkSync(path.join(sessionCacheDir, `${sessionId}${suffix}`));
            } catch {
                void 0;
            }
        }
    }
}

async function runClaudeHook(scriptPath: string, payload: Record<string, unknown>, port: number, options: RunClaudeHookOptions = {}) {
    const fallbackProjectDir = options.omitProjectDir
        ? (options.cwd ?? process.cwd())
        : (options.projectDir ?? "/repo");
    cleanupHookState(fallbackProjectDir, payload);
    const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tracer-hook-test-"));

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        MONITOR_PORT: String(port),
        HOME: isolatedHome,
        USERPROFILE: isolatedHome
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
    fs.rmSync(isolatedHome, { recursive: true, force: true });
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
    it("turn-ending runtime-session-end does not leave later tool events attached to a stale monitor session", async () => {
        const monitor = await startStatefulMonitorStub();
        servers.push(monitor);
        const sessionId = "stale-session-cache-turn-boundary";

        await runClaudeHook(userPromptHook, {
            session_id: sessionId,
            prompt: "first turn"
        }, monitor.port);
        await runClaudeHook(terminalHook, {
            session_id: sessionId,
            tool_name: "Bash",
            tool_input: { command: "echo 1" }
        }, monitor.port);
        await runClaudeHook(stopHook, {
            session_id: sessionId,
            stop_reason: "end_turn",
            last_assistant_message: "done"
        }, monitor.port);
        await runClaudeHook(userPromptHook, {
            session_id: sessionId,
            prompt: "second turn"
        }, monitor.port);
        await runClaudeHook(terminalHook, {
            session_id: sessionId,
            tool_name: "Bash",
            tool_input: { command: "echo 2" }
        }, monitor.port);

        const ingestEvents = monitor.calls
            .filter((call) => call.endpoint === "/ingest/v1/events")
            .flatMap((call) => call.body.events as Array<Record<string, unknown>>);
        const secondUserMessage = ingestEvents.find((event) => event.kind === "user.message" && event.body === "second turn");
        const secondTerminalCommand = ingestEvents.find((event) => event.kind === "terminal.command" && event.command === "echo 2");

        expect(secondUserMessage).toBeDefined();
        expect(secondTerminalCommand).toBeDefined();
        expect(secondTerminalCommand?.sessionId).toBe(secondUserMessage?.sessionId);
    });
    it("file hook preserves paths outside the workspace boundary instead of slicing by prefix", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(fileToolHook, {
            session_id: "outside-workspace-path-session",
            tool_name: "Edit",
            tool_input: { file_path: "/repo-other/src/index.ts" }
        }, monitor.port, { projectDir: "/repo" });

        const ingestCall = monitor.calls.find((call) => call.endpoint === "/ingest/v1/events");
        const events = Array.isArray(ingestCall?.body["events"])
            ? ingestCall.body["events"] as unknown[]
            : [];
        const event = events[0] as Record<string, unknown> | undefined;
        const metadata = event && typeof event.metadata === "object" && event.metadata !== null
            ? event.metadata as Record<string, unknown>
            : undefined;
        expect(event?.filePaths).toEqual(["/repo-other/src/index.ts"]);
        expect(metadata?.relPath).toBe("/repo-other/src/index.ts");
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
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "parent-session",
                    title: "Claude Code — repo",
                    workspacePath: "/repo"
                }
            },
            {
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "context.saved",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        title: "Session started",
                        body: "Claude Code session started.",
                        lane: "planning",
                        metadata: { trigger: "startup" }
                    }]
                }
            }
        ]);
    });
    it("SessionStart works without CLAUDE_PROJECT_DIR by falling back to cwd", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
        const sessionId = `session-start-no-project-dir-${Date.now()}`;
        await runClaudeHook(sessionStartHook, {
            session_id: sessionId,
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
                    runtimeSessionId: sessionId,
                    title: `Claude Code — ${path.basename(repoRoot)}`,
                    workspacePath: repoRoot
                }
            },
            {
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "context.saved",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        title: "Session started",
                        body: "Claude Code session started.",
                        lane: "planning",
                        metadata: { trigger: "startup" }
                    }]
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "context.saved",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        title: "Session resumed",
                        body: "Claude Code session resumed.",
                        lane: "planning",
                        metadata: { trigger: "resume" }
                    }]
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
    it("creates background Agent child sessions with parent linkage on first ensure", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(agentActivityHook, {
            tool_name: "Agent",
            session_id: "parent-session",
            tool_input: {
                description: "Review child monitor flow",
                prompt: "Inspect the child task",
                run_in_background: true,
                subagent_type: "default",
                items: [{ type: "text", text: "nested payload" }],
                options: { strict: true }
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "agent.activity.logged",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        activityType: "delegation",
                        title: "Agent: Review child monitor flow",
                        body: "Inspect the child task",
                        metadata: {
                            toolInput: {
                                description: "Review child monitor flow",
                                prompt: "Inspect the child task",
                                run_in_background: true,
                                subagent_type: "default",
                                items: [{ type: "text", text: "nested payload" }],
                                options: { strict: true }
                            }
                        },
                        agentName: "default"
                    }]
                }
            },
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: monitor.childRuntimeSessionId,
                    title: "Review child monitor flow",
                    workspacePath: "/repo",
                    parentTaskId: "parent-task",
                    parentSessionId: "parent-monitor-session"
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "context.saved",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        title: "Context compacted",
                        body: "Compacted summary",
                        lane: "planning",
                        metadata: {
                            trigger: "manual",
                            compactPhase: "after"
                        }
                    }]
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
        await runClaudeHook(subagentStopHook, {
            hook_event_name: "SubagentStop",
            session_id: "parent-session",
            agent_id: "agent-123",
            agent_type: "Explore",
            last_assistant_message: "Analysis complete."
        }, monitor.port);
        expect(monitor.calls).toEqual([
            // SubagentStart: resolveSessionIds(parent)
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "parent-session",
                    title: "Claude Code — repo",
                    workspacePath: "/repo"
                }
            },
            // SubagentStart: resolveSubagentSessionIds → resolveSessionIds(parent) [FS cache miss in test env]
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "parent-session",
                    title: "Claude Code — repo",
                    workspacePath: "/repo"
                }
            },
            // SubagentStart: resolveSubagentSessionIds → ensureRuntimeSession(sub--agent-123)
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "sub--agent-123",
                    title: "Subagent: Explore",
                    workspacePath: "/repo",
                    parentTaskId: "parent-task",
                    parentSessionId: "parent-monitor-session"
                }
            },
            // SubagentStart: running async-task event (includes childTaskId)
            {
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "action.logged",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        asyncTaskId: "agent-123",
                        asyncStatus: "running",
                        title: "Subagent started: Explore",
                        metadata: {
                            agentId: "agent-123",
                            agentType: "Explore",
                            parentTaskId: "parent-task",
                            parentSessionId: "parent-session",
                            childTaskId: "parent-task"
                        }
                    }]
                }
            },
            // SubagentStop: resolveSessionIds(parent) [FS cache miss — new process]
            {
                endpoint: "/api/runtime-session-ensure",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "parent-session",
                    title: "Claude Code — repo",
                    workspacePath: "/repo"
                }
            },
            // SubagentStop: completed async-task event
            {
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "action.logged",
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
                    }]
                }
            },
            // SubagentStop: end virtual session for auto-completion
            {
                endpoint: "/api/runtime-session-end",
                body: {
                    runtimeSource: "claude-plugin",
                    runtimeSessionId: "sub--agent-123",
                    summary: "Subagent finished: Explore",
                    completeTask: false,
                    completionReason: "assistant_turn_complete"
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "todo.logged",
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
                    }]
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "tool.used",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        toolName: "Bash",
                        title: "Failed Bash",
                        body: "Command exited with non-zero status code 1",
                        command: "npm test",
                        metadata: {
                            description: "Run tests",
                            failed: true,
                            error: "Command exited with non-zero status code 1",
                            isInterrupt: false
                        }
                    }]
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "terminal.command",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        command: "npm run lint",
                        title: "Run lint",
                        body: "Run lint\n\n$ npm run lint",
                        metadata: {
                            description: "Run lint",
                            command: "npm run lint"
                        }
                    }]
                }
            }
        ]);
    });
    it("records MCP tool usage with parsed server and tool metadata", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(mcpHook, {
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
                endpoint: "/ingest/v1/events",
                body: {
                    events: [{
                        kind: "agent.activity.logged",
                        taskId: "parent-task",
                        sessionId: "parent-monitor-session",
                        activityType: "mcp_call",
                        title: "MCP: github/search_repositories",
                        body: "Used MCP tool github/search_repositories",
                        mcpServer: "github",
                        mcpTool: "search_repositories",
                        metadata: {
                            mcpServer: "github",
                            mcpTool: "search_repositories"
                        }
                    }]
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
        const ingestCall = monitor.calls.find(c => c.endpoint === "/ingest/v1/events");
        expect(ingestCall).toBeDefined();
        const events = ingestCall!.body.events as Array<Record<string, unknown>>;
        const response = events.find(e => e.kind === "assistant.response");
        expect(response).toBeDefined();
        expect(response!.source).toBe("claude-plugin");
        expect(response!.body).toBe("I'll fix the bug by editing the file.");
        expect(response!.title).toBe("I'll fix the bug by editing the file.");
        expect((response!.metadata as Record<string, unknown>).stopReason).toBe("end_turn");
        expect((response!.metadata as Record<string, unknown>).inputTokens).toBe(100);
        expect((response!.metadata as Record<string, unknown>).outputTokens).toBe(40);
        const sessionEnd = monitor.calls.find(c => c.endpoint === "/api/runtime-session-end");
        expect(sessionEnd).toEqual({
            endpoint: "/api/runtime-session-end",
            body: {
                runtimeSource: "claude-plugin",
                runtimeSessionId: "parent-session",
                summary: "Assistant turn completed (end_turn)",
                completeTask: true,
                completionReason: "assistant_turn_complete"
            }
        });
    });
    it("Stop hook: subagent responses do not complete the parent task", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(stopHook, {
            session_id: "parent-session",
            agent_id: "agent-123",
            stop_reason: "end_turn",
            last_assistant_message: "Subagent report"
        }, monitor.port);
        const ingestCall = monitor.calls.find(c => c.endpoint === "/ingest/v1/events");
        expect(ingestCall).toBeDefined();
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
        const ingestCall = monitor.calls.find(c => c.endpoint === "/ingest/v1/events");
        expect(ingestCall).toBeDefined();
        const events = ingestCall!.body.events as Array<Record<string, unknown>>;
        const response = events.find(e => e.kind === "assistant.response");
        expect(response).toBeDefined();
        expect(response!.body).toBe("The answer is 4.");
        const meta = response!.metadata as Record<string, unknown>;
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
        const ingestCall = monitor.calls.find(c => c.endpoint === "/ingest/v1/events");
        expect(ingestCall).toBeDefined();
        const events = ingestCall!.body.events as Array<Record<string, unknown>>;
        const response = events.find(e => e.kind === "assistant.response");
        expect(response).toBeDefined();
        expect(response!.body).toBeUndefined();
        expect(response!.title).toBe("Response (max_turns)");
    });
    it("Stop hook: missing usage → no token metadata fields", async () => {
        const monitor = await startMonitorStub();
        servers.push(monitor);
        await runClaudeHook(stopHook, {
            session_id: "parent-session",
            stop_reason: "end_turn",
            last_assistant_message: "Done."
        }, monitor.port);
        const ingestCall = monitor.calls.find(c => c.endpoint === "/ingest/v1/events");
        expect(ingestCall).toBeDefined();
        const events = ingestCall!.body.events as Array<Record<string, unknown>>;
        const response = events.find(e => e.kind === "assistant.response");
        expect(response).toBeDefined();
        const meta = response!.metadata as Record<string, unknown>;
        expect(meta).not.toHaveProperty("inputTokens");
        expect(meta).not.toHaveProperty("outputTokens");
    });
});
