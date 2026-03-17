import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMonitorHooks } from "../../../.opencode/plugins/monitor.js";

interface FetchCall {
  readonly endpoint: string;
  readonly body: Record<string, unknown>;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function requestUrl(input: string | URL | globalThis.Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function sessionEvent(
  type: "session.created" | "session.deleted",
  sessionId: string,
  overrides?: { title?: string; directory?: string }
) {
  return {
    type,
    properties: {
      info: {
        id: sessionId,
        projectID: "project-1",
        directory: overrides?.directory ?? "/repo",
        title: overrides?.title ?? `Session ${sessionId}`,
        version: "1",
        time: {
          created: 0,
          updated: 0
        }
      }
    }
  };
}

function commandExecutedEvent(
  overrides: Record<string, unknown>
): never {
  return {
    type: "command.executed",
    properties: {
      ...overrides
    }
  } as never;
}

function tuiCommandEvent(command: string): never {
  return {
    type: "tui.command.execute",
    properties: { command }
  } as never;
}

function serverDisposedEvent(directory: string = "/repo"): never {
  return {
    type: "server.instance.disposed",
    properties: { directory }
  } as never;
}

describe("OpenCode monitor plugin", () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        return jsonResponse({
          task: { id: `task-${opencodeSessionId}` },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }

      return jsonResponse({ ok: true });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps concurrent OpenCode sessions isolated", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-a") });
    await hooks.event?.({ event: sessionEvent("session.created", "session-b") });

    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-a",
        callID: "call-a",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-b",
        callID: "call-b",
        args: { command: "ls" }
      },
      {
        title: "ls",
        output: "file-a\nfile-b",
        metadata: {}
      }
    );

    await hooks.event?.({ event: sessionEvent("session.deleted", "session-a") });
    await hooks.event?.({ event: sessionEvent("session.deleted", "session-b") });

    expect(calls.filter(c => c.endpoint === "/api/task-start")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/rule")).toHaveLength(0);
    expect(calls.filter(c => c.endpoint === "/api/terminal-command")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/session-end")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/task-complete")).toHaveLength(0);

    const taskStartBodies = calls
      .filter(c => c.endpoint === "/api/task-start")
      .map(c => c.body);
    expect(taskStartBodies).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: "opencode-session-a" }),
      expect.objectContaining({ taskId: "opencode-session-b" })
    ]));


    // session-end 가 세션별로 올바른 taskId/sessionId를 사용한다
    const sessionEndBodies = calls
      .filter(c => c.endpoint === "/api/session-end")
      .map(c => c.body);
    expect(sessionEndBodies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: "task-session-a",
        sessionId: "monitor-session-a",
        completeTask: true,
        metadata: expect.objectContaining({ opencodeSessionId: "session-a" })
      }),
      expect.objectContaining({
        taskId: "task-session-b",
        sessionId: "monitor-session-b",
        completeTask: true,
        metadata: expect.objectContaining({ opencodeSessionId: "session-b" })
      })
    ]));
  });

  it("deduplicates task creation when a tool starts before session initialization finishes", async () => {
    let resolveTaskStart: (() => void) | undefined;

    vi.stubGlobal("fetch", vi.fn((url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        return new Promise<Response>((resolve) => {
          resolveTaskStart = () => {
            const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
            resolve(jsonResponse({
              task: { id: `task-${opencodeSessionId}` },
              sessionId: `monitor-${opencodeSessionId}`
            }));
          };
        });
      }

      return Promise.resolve(jsonResponse({ ok: true }));
    }));

    const hooks = createMonitorHooks("/repo");

    const started = hooks.event?.({ event: sessionEvent("session.created", "session-race") });
    const ensured = hooks["tool.execute.before"]?.(
      {
        tool: "bash",
        sessionID: "session-race",
        callID: "call-race"
      },
      { args: { command: "pwd" } }
    );

    expect(calls.filter((call) => call.endpoint === "/api/task-start")).toHaveLength(1);

    resolveTaskStart?.();
    await started;
    await ensured;

    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-race",
        callID: "call-race",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );

    expect(calls.filter((call) => call.endpoint === "/api/task-start")).toHaveLength(1);
    expect(calls.at(-1)).toEqual({
      endpoint: "/api/terminal-command",
      body: expect.objectContaining({
        taskId: "task-session-race",
        sessionId: "monitor-session-race"
      })
    });
  });

  it("ignores delayed tool events after a session has already ended", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-late") });
    await hooks.event?.({ event: sessionEvent("session.deleted", "session-late") });

    const callsBeforeLateEvent = calls.length;

    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-late",
        callID: "call-late",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );

    expect(calls).toHaveLength(callsBeforeLateEvent);
    expect(calls.filter((call) => call.endpoint === "/api/task-start")).toHaveLength(0);
    expect(calls.filter((call) => call.endpoint === "/api/terminal-command")).toHaveLength(0);
  });

  it("deduplicates repeated tool.execute.after callbacks with same callID", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-dedupe") });

    const input = {
      tool: "grep",
      sessionID: "session-dedupe",
      callID: "call-same",
      args: { pattern: "foo", path: "src/app.ts" }
    };
    const output = {
      title: "grep",
      output: "match",
      metadata: {}
    };

    await hooks["tool.execute.after"]?.(input, output);
    await hooks["tool.execute.after"]?.(input, output);

    expect(calls.filter((call) => call.endpoint === "/api/explore")).toHaveLength(1);
  });

  it("session.deleted sends completeTask:true when /api/task-link failed for child-first launch", async () => {
    // Simulate: child starts first (primary), parent fires task tool,
    // /api/task-link returns error → DB row stays "primary".
    // session.deleted must still close the task (completeTask:true).
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        return jsonResponse({
          task: { id: `task-${opencodeSessionId}` },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }

      if (endpoint === "/api/task-link") {
        // Simulate server failure for task-link
        return new Response("Internal Server Error", { status: 500 });
      }

      return jsonResponse({ ok: true });
    }));

    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-fl") });
    await hooks.event?.({ event: sessionEvent("session.created", "child-fl") });

    // Child starts (primary) before the parent fires the background task tool
    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID: "child-fl", callID: "call-child-fl" },
      { args: { filePath: "src/child.ts" } }
    );

    // Parent fires background task tool → link POST fails
    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-fl",
        callID: "call-parent-fl",
        args: { run_in_background: true, description: "Failing link child" }
      },
      {
        title: "task",
        output: "session_id: child-fl",
        metadata: { session_id: "child-fl" }
      }
    );

    // Child session ends — link is unconfirmed, retry also fails
    await hooks.event?.({ event: sessionEvent("session.deleted", "child-fl") });

    const sessionEndCalls = calls.filter(c => c.endpoint === "/api/session-end");
    expect(sessionEndCalls).toHaveLength(1);
    // Must send completeTask:true so the "primary" DB row actually closes
    expect(sessionEndCalls[0]?.body).toEqual(expect.objectContaining({
      taskId: "task-child-fl",
      completeTask: true
    }));
  });

  it("does not flip local state to background when /api/task-link returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        return jsonResponse({
          task: { id: `task-${opencodeSessionId}` },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }

      if (endpoint === "/api/task-link") {
        return new Response("error", { status: 503 });
      }

      return jsonResponse({ ok: true });
    }));

    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-noflip") });
    await hooks.event?.({ event: sessionEvent("session.created", "child-noflip") });
    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID: "child-noflip", callID: "call-noflip" },
      { args: {} }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-noflip",
        callID: "call-parent-noflip",
        args: { run_in_background: true, description: "noflip child" }
      },
      {
        title: "task",
        output: "session_id: child-noflip",
        metadata: { session_id: "child-noflip" }
      }
    );

    // The failed task-link should not flip the child to background.
    // session.deleted retry also fails → completeTask must be true.
    await hooks.event?.({ event: sessionEvent("session.deleted", "child-noflip") });

    const sessionEndCall = calls.find(c => c.endpoint === "/api/session-end" &&
      (c.body as Record<string, unknown>).taskId === "task-child-noflip");
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({ completeTask: true }));
  });

  it("session.deleted sends completeTask:false for confirmed-background child", async () => {
    // Normal path: link succeeds → local state is background → completeTask:false
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-ok") });
    await hooks.event?.({ event: sessionEvent("session.created", "child-ok") });
    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID: "child-ok", callID: "call-child-ok" },
      { args: {} }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-ok",
        callID: "call-parent-ok",
        args: { run_in_background: true, description: "Confirmed background child" }
      },
      {
        title: "task",
        output: "session_id: child-ok\nBackground Task ID: bg-ok",
        metadata: { session_id: "child-ok", background_task_id: "bg-ok" }
      }
    );

    await hooks.event?.({ event: sessionEvent("session.deleted", "child-ok") });

    const sessionEndCalls = calls.filter(c =>
      c.endpoint === "/api/session-end" &&
      (c.body as Record<string, unknown>).taskId === "task-child-ok"
    );
    expect(sessionEndCalls).toHaveLength(1);
    // Link succeeded → DB row is "background" → server auto-completes → completeTask:false
    expect(sessionEndCalls[0]?.body).toEqual(expect.objectContaining({ completeTask: false }));
  });

  it("promotes already-started child session to background via task-link", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-session") });
    await hooks.event?.({ event: sessionEvent("session.created", "child-session") });

    await hooks["tool.execute.before"]?.(
      {
        tool: "read",
        sessionID: "child-session",
        callID: "call-child-init"
      },
      { args: { filePath: "src/child.ts" } }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-session",
        callID: "call-parent-task",
        args: {
          run_in_background: true,
          description: "Background child"
        }
      },
      {
        title: "task",
        output: "Background Task ID: bg-1\nsession_id: child-session",
        metadata: {
          session_id: "child-session",
          background_task_id: "bg-1"
        }
      }
    );

    const taskLinkCall = calls.find((call) => call.endpoint === "/api/task-link");
    expect(taskLinkCall).toBeDefined();
    expect(taskLinkCall?.body).toEqual(expect.objectContaining({
      taskId: "task-child-session",
      title: "Background child",
      taskKind: "background",
      parentTaskId: "task-parent-session",
      backgroundTaskId: "bg-1"
    }));
  });

  it("starts delayed child background sessions with the background title", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-delayed") });

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-delayed",
        callID: "call-parent-delayed",
        args: {
          run_in_background: true,
          description: "Inspect git internals"
        }
      },
      {
        title: "task",
        output: "Background Task ID: bg-delayed\nsession_id: child-delayed",
        metadata: {
          session_id: "child-delayed",
          background_task_id: "bg-delayed"
        }
      }
    );

    await hooks.event?.({ event: sessionEvent("session.created", "child-delayed") });

    await hooks["tool.execute.before"]?.(
      {
        tool: "read",
        sessionID: "child-delayed",
        callID: "call-child-delayed"
      },
      { args: { filePath: "README.md" } }
    );

    const startCalls = calls.filter((call) => call.endpoint === "/api/task-start");
    const childStart = startCalls.find((call) => call.body.metadata && String((call.body.metadata as Record<string, unknown>).opencodeSessionId) === "child-delayed");

    expect(childStart).toBeDefined();
    expect(childStart?.body).toEqual(expect.objectContaining({
      taskId: "opencode-child-delayed",
      title: "Inspect git internals",
      taskKind: "background",
      parentTaskId: "task-parent-delayed",
      backgroundTaskId: "bg-delayed"
    }));
  });

  it("links background children launched through parallel wrapper", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-parallel") });
    await hooks.event?.({ event: sessionEvent("session.created", "child-parallel") });

    await hooks["tool.execute.before"]?.(
      {
        tool: "read",
        sessionID: "child-parallel",
        callID: "call-child-parallel"
      },
      { args: { filePath: "src/child.ts" } }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "multi_tool_use.parallel",
        sessionID: "parent-parallel",
        callID: "call-parent-parallel",
        args: {
          tool_uses: [
            {
              recipient_name: "functions.task",
              parameters: {
                run_in_background: true,
                description: "Parallel background child"
              }
            }
          ]
        }
      },
      {
        title: "parallel",
        output: "Background Task ID: bg-parallel\nsession_id: child-parallel",
        metadata: {}
      }
    );

    const taskLinkCall = calls.find((call) => call.endpoint === "/api/task-link");
    expect(taskLinkCall).toBeDefined();
    expect(taskLinkCall?.body).toEqual(expect.objectContaining({
      taskId: "task-child-parallel",
      title: "Parallel background child",
      taskKind: "background",
      parentTaskId: "task-parent-parallel",
      backgroundTaskId: "bg-parallel"
    }));
  });

  it("reuses the background task row for nested subagent sessions and finalizes on reminder", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        const requestedTaskId = typeof body.taskId === "string" ? body.taskId : undefined;
        const taskId = requestedTaskId === "task-child-nested"
          ? requestedTaskId
          : `task-${opencodeSessionId}`;
        return jsonResponse({
          task: { id: taskId },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }

      return jsonResponse({ ok: true });
    }));

    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-nested") });
    await hooks.event?.({ event: sessionEvent("session.created", "child-nested") });
    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID: "child-nested", callID: "call-child-nested" },
      { args: {} }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-nested",
        callID: "call-parent-nested",
        args: { run_in_background: true, description: "Confirmed background child" }
      },
      {
        title: "task",
        output: "session_id: child-nested\nBackground Task ID: bg_nested",
        metadata: { session_id: "child-nested", background_task_id: "bg_nested" }
      }
    );

    await hooks.event?.({
      event: sessionEvent("session.created", "nested-subagent", {
        title: "Confirmed background child (@explore subagent)"
      })
    });

    await hooks["tool.execute.before"]?.(
      { tool: "grep", sessionID: "nested-subagent", callID: "call-nested-subagent" },
      { args: { pattern: "background" } }
    );

    const nestedStartCall = calls.find((call) => call.endpoint === "/api/task-start"
      && String((call.body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "nested-subagent");
    expect(nestedStartCall?.body).toEqual(expect.objectContaining({
      taskId: "task-child-nested",
      title: "Confirmed background child",
      taskKind: "background",
      parentTaskId: "task-parent-nested",
      backgroundTaskId: "bg_nested"
    }));

    await hooks["chat.message"]?.(
      {
        sessionID: "parent-nested",
        model: { modelID: "m1", providerID: "p1" }
      } as never,
      {
        message: { id: "msg-bg-complete" },
        parts: [
          {
            type: "input_text",
            content: "<system-reminder>\n[BACKGROUND TASK COMPLETED]\n**ID:** `bg_nested`\n</system-reminder>"
          }
        ]
      } as never
    );

    const childSessionEndCalls = calls.filter((call) => call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-child-nested");
    expect(childSessionEndCalls).toHaveLength(2);
    expect(childSessionEndCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: expect.objectContaining({ sessionId: "monitor-child-nested", completeTask: false }) }),
      expect.objectContaining({ body: expect.objectContaining({ sessionId: "monitor-nested-subagent", completeTask: false }) })
    ]));

    const completedAsyncCalls = calls.filter((call) => call.endpoint === "/api/async-task"
      && String(call.body.asyncTaskId) === "bg_nested"
      && String(call.body.asyncStatus) === "completed");
    expect(completedAsyncCalls).toHaveLength(1);
    expect(completedAsyncCalls[0]?.body).toEqual(expect.objectContaining({
      taskId: "task-parent-nested",
      title: "Confirmed background child"
    }));
  });

  it("reuses deterministic taskId when the same OpenCode session ID reconnects", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-reconnect") });
    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-reconnect",
        callID: "call-reconnect-1",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );
    await hooks.event?.({ event: sessionEvent("session.deleted", "session-reconnect") });

    await hooks.event?.({ event: sessionEvent("session.created", "session-reconnect") });
    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-reconnect",
        callID: "call-reconnect-2",
        args: { command: "ls" }
      },
      {
        title: "ls",
        output: "a\nb",
        metadata: {}
      }
    );

    const startBodies = calls
      .filter((call) => call.endpoint === "/api/task-start")
      .map((call) => call.body)
      .filter((body) => String((body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "session-reconnect");

    expect(startBodies).toHaveLength(2);
    expect(startBodies[0]).toEqual(expect.objectContaining({ taskId: "opencode-session-reconnect" }));
    expect(startBodies[1]).toEqual(expect.objectContaining({ taskId: "opencode-session-reconnect" }));
  });

  it("maps TodoWrite tool calls to todo lifecycle events", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-todo") });

    await hooks["tool.execute.after"]?.(
      {
        tool: "TodoWrite",
        sessionID: "session-todo",
        callID: "call-todo-1",
        args: {
          todos: [
            { content: "Track OpenCode todo state", status: "pending", priority: "high" }
          ]
        }
      },
      {
        title: "1 todo",
        output: "ok",
        metadata: {}
      }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "TodoWrite",
        sessionID: "session-todo",
        callID: "call-todo-2",
        args: {
          todos: [
            { content: "Track OpenCode todo state", status: "in_progress", priority: "high" }
          ]
        }
      },
      {
        title: "1 todo",
        output: "ok",
        metadata: {}
      }
    );

    const todoCalls = calls.filter((call) => call.endpoint === "/api/todo");
    expect(todoCalls).toHaveLength(2);
    expect(todoCalls[0]?.body).toEqual(expect.objectContaining({
      taskId: "task-session-todo",
      sessionId: "monitor-session-todo",
      todoState: "added",
      title: "Track OpenCode todo state"
    }));
    expect(todoCalls[1]?.body).toEqual(expect.objectContaining({
      taskId: "task-session-todo",
      sessionId: "monitor-session-todo",
      todoState: "in_progress",
      title: "Track OpenCode todo state"
    }));
    expect(calls.filter((call) => call.endpoint === "/api/tool-used")).toHaveLength(0);
  });

  it("routes monitor_question and monitor_thought tools to semantic endpoints", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-semantic") });

    await hooks["tool.execute.after"]?.(
      {
        tool: "monitor_question",
        sessionID: "session-semantic",
        callID: "call-question",
        args: {
          questionId: "q-1",
          questionPhase: "asked",
          title: "Need clarification",
          body: "Confirm the runtime behavior"
        }
      },
      {
        title: "question",
        output: "ok",
        metadata: {}
      }
    );

    await hooks["tool.execute.after"]?.(
      {
        tool: "monitor_thought",
        sessionID: "session-semantic",
        callID: "call-thought",
        args: {
          title: "Likely mixed runtime hooks",
          body: "Need stricter runtime gate"
        }
      },
      {
        title: "thought",
        output: "ok",
        metadata: {}
      }
    );

    const questionCalls = calls.filter((call) => call.endpoint === "/api/question");
    const thoughtCalls = calls.filter((call) => call.endpoint === "/api/thought");

    expect(questionCalls).toHaveLength(1);
    expect(questionCalls[0]?.body).toEqual(expect.objectContaining({
      taskId: "task-session-semantic",
      sessionId: "monitor-session-semantic",
      questionId: "q-1",
      questionPhase: "asked",
      title: "Need clarification"
    }));

    expect(thoughtCalls).toHaveLength(1);
    expect(thoughtCalls[0]?.body).toEqual(expect.objectContaining({
      taskId: "task-session-semantic",
      sessionId: "monitor-session-semantic",
      title: "Likely mixed runtime hooks"
    }));

    expect(calls.filter((call) => call.endpoint === "/api/tool-used")).toHaveLength(0);
  });

  it("parses wrapped oh-my-opencode user messages and extracts referenced file paths", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-wrapped") });

    await hooks["chat.message"]?.(
      {
        sessionID: "session-wrapped",
        model: { modelID: "m1", providerID: "p1" }
      } as never,
      {
        message: { id: "msg-wrapped-1" },
        parts: [
          {
            type: "input_text",
            content: "[search-mode]\nMAXIMIZE SEARCH EFFORT.\n---\n@.opencode/plugins/monitor.ts 에서 확인해줘\n`packages/server/src/application/monitor-service.ts` 도 봐줘"
          }
        ]
      } as never
    );

    const userMessageCall = calls.find((call) => call.endpoint === "/api/user-message");
    expect(userMessageCall).toBeDefined();
    expect(String(userMessageCall?.body.title)).toContain("@.opencode/plugins/monitor.ts");

    const metadata = userMessageCall?.body.metadata as Record<string, unknown>;
    const filePaths = metadata.filePaths as string[];
    expect(filePaths).toEqual(expect.arrayContaining([
      ".opencode/plugins/monitor.ts",
      "packages/server/src/application/monitor-service.ts"
    ]));
  });

  it("extracts file paths from nested stringified tool input payloads", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-nested-path") });

    await hooks["tool.execute.after"]?.(
      {
        tool: "grep",
        sessionID: "session-nested-path",
        callID: "call-nested-path",
        args: {
          payload: JSON.stringify({
            toolInput: {
              path: "packages/web/src/components/Timeline.tsx"
            }
          })
        }
      },
      {
        title: "explore",
        output: "ok",
        metadata: {}
      }
    );

    const exploreCall = calls.find((call) => call.endpoint === "/api/explore");
    expect(exploreCall).toBeDefined();
    expect(exploreCall?.body.filePaths).toEqual(expect.arrayContaining([
      "packages/web/src/components/Timeline.tsx"
    ]));
  });

  it("finalizes session on /exit command with nested session payload", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-exit") });

    await hooks.event?.({
      event: commandExecutedEvent({
        command: "/exit now",
        session: { id: "session-exit" }
      })
    });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-exit"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      sessionId: "monitor-session-exit",
      completeTask: true,
      summary: "OpenCode exit command executed"
    }));
  });

  it("accepts session_id shape for /exit command events", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-exit-snake") });

    await hooks.event?.({
      event: commandExecutedEvent({
        name: "'/exit'",
        session_id: "session-exit-snake"
      })
    });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-exit-snake"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      summary: "OpenCode exit command executed"
    }));
  });

  it("accepts command object payload for /exit events", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-exit-command-object") });

    await hooks.event?.({
      event: commandExecutedEvent({
        title: "OpenCode command",
        command: { name: "/exit" },
        session: { id: "session-exit-command-object" }
      })
    });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-exit-command-object"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      summary: "OpenCode exit command executed"
    }));
  });

  it("accepts info.session_id shape for /exit command events", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-exit-info-snake") });

    await hooks.event?.({
      event: commandExecutedEvent({
        input: "/exit",
        info: { session_id: "session-exit-info-snake" }
      })
    });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-exit-info-snake"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      summary: "OpenCode exit command executed"
    }));
  });

  it("detects /exit token from args array even when not first", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-exit-args") });

    await hooks.event?.({
      event: commandExecutedEvent({
        args: ["now", "'/exit'"],
        sessionID: "session-exit-args"
      })
    });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-exit-args"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      summary: "OpenCode exit command executed"
    }));
  });

  it("finalizes session via command.execute.before for /exit", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-exit-before") });

    await hooks["command.execute.before"]?.(
      {
        command: "/exit",
        sessionID: "session-exit-before",
        arguments: ""
      },
      {
        parts: []
      }
    );

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-exit-before"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      sessionId: "monitor-session-exit-before",
      summary: "OpenCode exit command executed"
    }));
  });

  it("ignores non-exit command in command.execute.before", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-before-ignore") });

    await hooks["command.execute.before"]?.(
      {
        command: "session.list",
        sessionID: "session-before-ignore",
        arguments: ""
      },
      {
        parts: []
      }
    );

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-before-ignore"
    );
    expect(sessionEndCall).toBeUndefined();
  });

  it("finalizes active primary session on tui app.exit command", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-tui-exit") });
    await hooks.event?.({ event: tuiCommandEvent("app.exit") });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-tui-exit"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      summary: "OpenCode exit command executed"
    }));
  });

  it("ignores non-exit tui command", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-tui-ignore") });
    await hooks.event?.({ event: tuiCommandEvent("session.list") });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-tui-ignore"
    );
    expect(sessionEndCall).toBeUndefined();
  });

  it("finalizes active primary session on server.instance.disposed", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-dispose-exit") });
    await hooks.event?.({ event: serverDisposedEvent("/repo") });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-dispose-exit"
    );
    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      summary: "OpenCode exit command executed"
    }));
  });
});
