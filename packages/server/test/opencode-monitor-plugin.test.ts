import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMonitorHooks } from "../../../.opencode/plugins/monitor.js";

interface FetchCall {
  readonly endpoint: string;
  readonly body: Record<string, unknown>;
}

type MonitorHooks = ReturnType<typeof createMonitorHooks>;
type MonitorEvent = Parameters<NonNullable<MonitorHooks["event"]>>[0]["event"];
type ChatMessageHook = NonNullable<MonitorHooks["chat.message"]>;
type ChatMessageInput = Parameters<ChatMessageHook>[0];
type ChatMessageOutput = Parameters<ChatMessageHook>[1];

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
): MonitorEvent {
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

function sessionIdleEvent(sessionId: string): MonitorEvent {
  return {
    type: "session.idle",
    properties: {
      sessionID: sessionId
    }
  };
}

function assistantMessageUpdatedEvent(
  sessionId: string,
  messageId: string,
  overrides?: { finish?: string; completed?: number; error?: Record<string, unknown> }
): MonitorEvent {
  return {
    type: "message.updated",
    properties: {
      info: {
        id: messageId,
        sessionID: sessionId,
        role: "assistant",
        parentID: `parent-${messageId}`,
        modelID: "gpt-5.4",
        providerID: "openai",
        mode: "default",
        path: { cwd: "/repo", root: "/repo" },
        cost: 0,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 }
        },
        time: {
          created: 0,
          ...(overrides?.completed !== undefined ? { completed: overrides.completed } : { completed: 1 })
        },
        ...(overrides?.finish ? { finish: overrides.finish } : { finish: "stop" }),
        ...(overrides?.error ? { error: overrides.error } : {})
      }
    }
  };
}

function assistantMessageUpdatedEventWithParts(
  sessionId: string,
  messageId: string,
  parts: Array<{ type: string; text?: string }>,
  tokens?: { input?: number; output?: number; cache?: { read?: number; write?: number } }
): MonitorEvent {
  return {
    type: "message.updated",
    properties: {
      info: {
        id: messageId,
        sessionID: sessionId,
        role: "assistant",
        time: { created: 0, completed: 1 },
        finish: "stop",
        tokens: {
          input: tokens?.input ?? 0,
          output: tokens?.output ?? 0,
          reasoning: 0,
          cache: { read: tokens?.cache?.read ?? 0, write: tokens?.cache?.write ?? 0 }
        }
      },
      parts
    }
  } as unknown as MonitorEvent;
}

function commandExecutedEvent(
  overrides: Record<string, unknown>
): MonitorEvent {
  return {
    type: "command.executed",
    properties: {
      ...overrides
    }
  };
}

function tuiCommandEvent(command: string): MonitorEvent {
  return {
    type: "tui.command.execute",
    properties: { command }
  };
}

function serverDisposedEvent(directory: string = "/repo"): MonitorEvent {
  return {
    type: "server.instance.disposed",
    properties: { directory }
  };
}

function chatMessageInput(
  sessionId: string,
  model: ChatMessageInput["model"] = { modelID: "m1", providerID: "p1" }
): ChatMessageInput {
  return {
    sessionID: sessionId,
    model
  };
}

function chatMessageOutput(
  sessionId: string,
  messageId: string,
  text: string,
  model: NonNullable<ChatMessageInput["model"]> = { modelID: "m1", providerID: "p1" }
): ChatMessageOutput {
  return {
    message: {
      id: messageId,
      sessionID: sessionId,
      role: "user",
      time: {
        created: 0
      },
      agent: "default",
      model: {
        providerID: model.providerID,
        modelID: model.modelID
      }
    },
    parts: [
      {
        id: `part-${messageId}`,
        sessionID: sessionId,
        messageID: messageId,
        type: "text",
        text
      }
    ]
  };
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

  it("starts new OpenCode primary tasks with a workspace title instead of a session suffix title", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "ses_3006abcd") });
    await hooks["tool.execute.before"]?.(
      {
        tool: "bash",
        sessionID: "ses_3006abcd",
        callID: "call-session-title",
        args: { command: "pwd" }
      },
      { args: { command: "pwd" } }
    );

    const taskStartCall = calls.find((call) =>
      call.endpoint === "/api/task-start"
      && String((call.body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "ses_3006abcd"
    );
    expect(taskStartCall?.body).toEqual(expect.objectContaining({
      title: "OpenCode - repo",
      taskKind: "primary"
    }));
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

  it("starts wrapper and actual child sessions as one background lineage when the wrapper appears before task output", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        const requestedTaskId = typeof body.taskId === "string" ? body.taskId : undefined;
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        return jsonResponse({
          task: { id: requestedTaskId ?? `task-${opencodeSessionId}` },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }

      return jsonResponse({ ok: true });
    }));

    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-wrapper-first") });
    await hooks["tool.execute.before"]?.(
      {
        tool: "task",
        sessionID: "parent-wrapper-first",
        callID: "call-parent-wrapper-first",
        args: { run_in_background: true, description: "Python official updates" }
      },
      { args: { run_in_background: true, description: "Python official updates" } }
    );

    await hooks.event?.({
      event: sessionEvent("session.created", "wrapper-session", {
        title: "Python official updates (@librarian subagent)"
      })
    });
    await hooks["tool.execute.before"]?.(
      {
        tool: "grep",
        sessionID: "wrapper-session",
        callID: "call-wrapper-session",
        args: { pattern: "python" }
      },
      { args: { pattern: "python" } }
    );

    const wrapperStartCall = calls.find((call) =>
      call.endpoint === "/api/task-start"
      && String((call.body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "wrapper-session"
    );
    expect(wrapperStartCall?.body).toEqual(expect.objectContaining({
      title: "Python official updates",
      taskKind: "background",
      parentTaskId: "opencode-parent-wrapper-first"
    }));

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-wrapper-first",
        callID: "call-parent-wrapper-first",
        args: { run_in_background: true, description: "Python official updates" }
      },
      {
        title: "task",
        output: "Background Task ID: bg-wrapper-first\nsession_id: actual-child-session",
        metadata: {
          session_id: "actual-child-session",
          background_task_id: "bg-wrapper-first"
        }
      }
    );

    await hooks.event?.({ event: sessionEvent("session.created", "actual-child-session") });
    await hooks["tool.execute.before"]?.(
      {
        tool: "read",
        sessionID: "actual-child-session",
        callID: "call-actual-child-session",
        args: { filePath: "README.md" }
      },
      { args: { filePath: "README.md" } }
    );

    const childStartCall = calls.find((call) =>
      call.endpoint === "/api/task-start"
      && String((call.body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "actual-child-session"
    );
    expect(childStartCall?.body).toEqual(expect.objectContaining({
      taskId: "opencode-wrapper-session",
      title: "Python official updates",
      taskKind: "background",
      parentTaskId: "opencode-parent-wrapper-first",
      backgroundTaskId: "bg-wrapper-first"
    }));
  });

  it("reuses a wrapper primary session as the background task row when the real child session arrives later via the typed chat.message hook", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ endpoint, body });

      if (endpoint === "/api/task-start") {
        const requestedTaskId = typeof body.taskId === "string" ? body.taskId : undefined;
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        return jsonResponse({
          task: { id: requestedTaskId ?? `task-${opencodeSessionId}` },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }

      return jsonResponse({ ok: true });
    }));

    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "parent-wrapper-reuse") });
    await hooks.event?.({
      event: sessionEvent("session.created", "wrapper-primary", {
        title: "Java learning resources (@librarian subagent)"
      })
    });

    await hooks["chat.message"]?.(
      chatMessageInput("wrapper-primary", { modelID: "glm-4.7-free", providerID: "opencode" }),
      chatMessageOutput(
        "wrapper-primary",
        "msg-wrapper-primary",
        "1. TASK: Find high-quality Java learning resources beyond official docs.",
        { modelID: "glm-4.7-free", providerID: "opencode" }
      )
    );

    const wrapperStartCall = calls.find((call) =>
      call.endpoint === "/api/task-start"
      && String((call.body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "wrapper-primary"
    );
    expect(wrapperStartCall?.body).toEqual(expect.objectContaining({
      taskId: "opencode-wrapper-primary",
      title: "OpenCode - repo",
      taskKind: "primary"
    }));

    await hooks.event?.({ event: sessionIdleEvent("wrapper-primary") });

    const wrapperIdleCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.sessionId) === "monitor-wrapper-primary"
    );
    expect(wrapperIdleCall?.body).toEqual(expect.objectContaining({
      taskId: "opencode-wrapper-primary",
      completeTask: false,
      completionReason: "idle"
    }));

    await hooks["tool.execute.after"]?.(
      {
        tool: "task",
        sessionID: "parent-wrapper-reuse",
        callID: "call-parent-wrapper-reuse",
        args: {
          run_in_background: true,
          description: "Java learning resources"
        }
      },
      {
        title: "task",
        output: "Background Task ID: bg-wrapper-reuse\nsession_id: actual-wrapper-reuse",
        metadata: {
          session_id: "actual-wrapper-reuse",
          background_task_id: "bg-wrapper-reuse"
        }
      }
    );

    const wrapperLinkCall = calls.find((call) =>
      call.endpoint === "/api/task-link"
      && String(call.body.taskId) === "opencode-wrapper-primary"
    );
    expect(wrapperLinkCall?.body).toEqual(expect.objectContaining({
      taskId: "opencode-wrapper-primary",
      title: "Java learning resources",
      taskKind: "background",
      parentTaskId: "opencode-parent-wrapper-reuse",
      backgroundTaskId: "bg-wrapper-reuse"
    }));

    await hooks.event?.({ event: sessionEvent("session.created", "actual-wrapper-reuse") });
    await hooks["tool.execute.before"]?.(
      {
        tool: "read",
        sessionID: "actual-wrapper-reuse",
        callID: "call-actual-wrapper-reuse",
        args: { filePath: "README.md" }
      },
      { args: { filePath: "README.md" } }
    );

    const actualChildStartCall = calls.find((call) =>
      call.endpoint === "/api/task-start"
      && String((call.body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "actual-wrapper-reuse"
    );
    expect(actualChildStartCall?.body).toEqual(expect.objectContaining({
      taskId: "opencode-wrapper-primary",
      title: "Java learning resources",
      taskKind: "background",
      parentTaskId: "opencode-parent-wrapper-reuse",
      backgroundTaskId: "bg-wrapper-reuse"
    }));

    expect(calls.filter((call) =>
      call.endpoint === "/api/task-start"
      && String(call.body.taskId) === "opencode-actual-wrapper-reuse"
    )).toHaveLength(0);
  });

  it("reuses the background task row for nested subagent sessions and finalizes on reminder via the typed chat.message hook", async () => {
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
      chatMessageInput("parent-nested"),
      chatMessageOutput(
        "parent-nested",
        "msg-bg-complete",
        "<system-reminder>\n[BACKGROUND TASK COMPLETED]\n**ID:** `bg_nested`\n</system-reminder>"
      )
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

  it("marks an OpenCode idle session as waiting instead of completed", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-idle-complete") });
    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-idle-complete",
        callID: "call-idle-complete",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );

    await hooks.event?.({ event: sessionIdleEvent("session-idle-complete") });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-idle-complete"
    );

    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      taskId: "task-session-idle-complete",
      sessionId: "monitor-session-idle-complete",
      completeTask: false,
      completionReason: "idle",
      summary: "OpenCode session idle",
      metadata: expect.objectContaining({
        opencodeSessionId: "session-idle-complete",
        idleEvent: true,
        completionReason: "idle"
      })
    }));
    expect(calls.filter((call) => call.endpoint === "/api/task-complete")).toHaveLength(0);
  });

  it("reopens the same OpenCode task after idle waiting when a follow-up turn starts", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-idle-reopen") });
    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-idle-reopen",
        callID: "call-idle-reopen-1",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );
    await hooks.event?.({ event: sessionIdleEvent("session-idle-reopen") });

    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-idle-reopen",
        callID: "call-idle-reopen-2",
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
      .filter((body) => String((body.metadata as Record<string, unknown> | undefined)?.opencodeSessionId) === "session-idle-reopen");

    expect(startBodies).toHaveLength(2);
    expect(startBodies[0]).toEqual(expect.objectContaining({ taskId: "opencode-session-idle-reopen" }));
    expect(startBodies[1]).toEqual(expect.objectContaining({ taskId: "opencode-session-idle-reopen" }));

    const secondToolCall = calls.find((call) =>
      call.endpoint === "/api/terminal-command"
      && String(call.body.command) === "ls"
    );
    expect(secondToolCall?.body).toEqual(expect.objectContaining({
      taskId: "task-session-idle-reopen",
      sessionId: "monitor-session-idle-reopen"
    }));
  });

  it("keeps post-idle user messages in follow_up phase for the same task via the typed chat.message hook", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-user-phase") });
    await hooks["chat.message"]?.(
      chatMessageInput("session-user-phase"),
      chatMessageOutput("session-user-phase", "msg-user-phase-1", "첫 번째 요청")
    );

    await hooks.event?.({ event: sessionIdleEvent("session-user-phase") });

    await hooks["chat.message"]?.(
      chatMessageInput("session-user-phase"),
      chatMessageOutput("session-user-phase", "msg-user-phase-2", "두 번째 요청")
    );

    const userMessageCalls = calls.filter((call) => call.endpoint === "/api/user-message");
    expect(userMessageCalls).toHaveLength(2);
    expect(userMessageCalls[0]?.body).toEqual(expect.objectContaining({
      taskId: "task-session-user-phase",
      phase: "initial"
    }));
    expect(userMessageCalls[1]?.body).toEqual(expect.objectContaining({
      taskId: "task-session-user-phase",
      phase: "follow_up"
    }));
  });

  it("completes a primary task when the assistant publishes a final answer", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-answer-complete") });
    await hooks["tool.execute.after"]?.(
      {
        tool: "bash",
        sessionID: "session-answer-complete",
        callID: "call-answer-complete",
        args: { command: "pwd" }
      },
      {
        title: "pwd",
        output: "/repo",
        metadata: {}
      }
    );

    await hooks.event?.({
      event: assistantMessageUpdatedEvent("session-answer-complete", "assistant-msg-1")
    });

    const sessionEndCall = calls.find((call) =>
      call.endpoint === "/api/session-end"
      && String(call.body.taskId) === "task-session-answer-complete"
    );

    expect(sessionEndCall?.body).toEqual(expect.objectContaining({
      taskId: "task-session-answer-complete",
      sessionId: "monitor-session-answer-complete",
      completeTask: true,
      completionReason: "assistant_turn_complete",
      summary: "OpenCode assistant completed turn",
      metadata: expect.objectContaining({
        opencodeSessionId: "session-answer-complete",
        completionReason: "assistant_turn_complete",
        messageId: "assistant-msg-1",
        finish: "stop"
      })
    }));
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

  it("parses wrapped oh-my-opencode user messages and extracts referenced file paths via the typed chat.message hook", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-wrapped") });

    await hooks["chat.message"]?.(
      chatMessageInput("session-wrapped"),
      chatMessageOutput(
        "session-wrapped",
        "msg-wrapped-1",
        "[search-mode]\nMAXIMIZE SEARCH EFFORT.\n---\n@.opencode/plugins/monitor.ts 에서 확인해줘\n`packages/server/src/application/monitor-service.ts` 도 봐줘"
      )
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

  it("finalizes session on documented commandExecutedEvent /exit payload", async () => {
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

  it("accepts session_id shape for documented /exit commandExecutedEvent payload", async () => {
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

  it("accepts command object payload for documented /exit event", async () => {
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

  it("accepts info.session_id shape for documented /exit commandExecutedEvent payload", async () => {
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

  it("detects /exit token from args array even when not first in documented commandExecutedEvent payload", async () => {
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

  it("finalizes session via the typed command.execute.before hook for /exit", async () => {
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

  it("finalizes active primary session on documented tui app.exit command", async () => {
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

  it("finalizes active primary session on the typed server.instance.disposed event", async () => {
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

  it("emits assistant-response when message.updated has text parts", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-ar-1") });
    await hooks["tool.execute.after"]?.(
      { tool: "bash", sessionID: "session-ar-1", callID: "call-ar-1", args: { command: "pwd" } },
      { title: "pwd", output: "/repo", metadata: {} }
    );
    await hooks.event?.({
      event: assistantMessageUpdatedEventWithParts(
        "session-ar-1", "msg-ar-1",
        [{ type: "text", text: "Hello, this is the assistant response." }]
      )
    });

    const arCall = calls.find((c) => c.endpoint === "/api/assistant-response");
    expect(arCall?.body).toEqual(expect.objectContaining({
      taskId: "task-session-ar-1",
      sessionId: "monitor-session-ar-1",
      messageId: "msg-ar-1",
      source: "opencode-plugin",
      title: "Hello, this is the assistant response.",
      body: "Hello, this is the assistant response."
    }));
  });

  it("skips assistant-response when message.updated has no text parts", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-ar-2") });
    await hooks["tool.execute.after"]?.(
      { tool: "bash", sessionID: "session-ar-2", callID: "call-ar-2", args: { command: "pwd" } },
      { title: "pwd", output: "/repo", metadata: {} }
    );
    await hooks.event?.({
      event: assistantMessageUpdatedEvent("session-ar-2", "msg-ar-2")
    });

    expect(calls.find((c) => c.endpoint === "/api/assistant-response")).toBeUndefined();
  });

  it("includes token counts in assistant-response metadata", async () => {
    const hooks = createMonitorHooks("/repo");

    await hooks.event?.({ event: sessionEvent("session.created", "session-ar-3") });
    await hooks["tool.execute.after"]?.(
      { tool: "bash", sessionID: "session-ar-3", callID: "call-ar-3", args: { command: "pwd" } },
      { title: "pwd", output: "/repo", metadata: {} }
    );
    await hooks.event?.({
      event: assistantMessageUpdatedEventWithParts(
        "session-ar-3", "msg-ar-3",
        [{ type: "text", text: "Response with tokens." }],
        { input: 100, output: 50, cache: { read: 25, write: 10 } }
      )
    });

    const arCall = calls.find((c) => c.endpoint === "/api/assistant-response");
    expect(arCall?.body.metadata).toEqual(expect.objectContaining({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 25,
      cacheWriteTokens: 10
    }));
  });

  it("non-fatal assistant-response failure does not prevent session finalization", async () => {
    const localCalls: FetchCall[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
      const endpoint = new URL(requestUrl(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (endpoint === "/api/assistant-response") throw new Error("network error");
      localCalls.push({ endpoint, body });
      if (endpoint === "/api/task-start") {
        const opencodeSessionId = String(body.metadata && (body.metadata as Record<string, unknown>).opencodeSessionId);
        return jsonResponse({
          task: { id: `task-${opencodeSessionId}` },
          sessionId: `monitor-${opencodeSessionId}`
        });
      }
      return jsonResponse({ ok: true });
    }));

    const hooks = createMonitorHooks("/repo");
    await hooks.event?.({ event: sessionEvent("session.created", "session-ar-4") });
    await hooks["tool.execute.after"]?.(
      { tool: "bash", sessionID: "session-ar-4", callID: "call-ar-4", args: { command: "pwd" } },
      { title: "pwd", output: "/repo", metadata: {} }
    );
    await hooks.event?.({
      event: assistantMessageUpdatedEventWithParts(
        "session-ar-4", "msg-ar-4",
        [{ type: "text", text: "Should fail but finalize anyway." }]
      )
    });

    const sessionEndCall = localCalls.find(
      (c) => c.endpoint === "/api/session-end" && String(c.body.taskId) === "task-session-ar-4"
    );
    expect(sessionEndCall).toBeDefined();
  });
});
