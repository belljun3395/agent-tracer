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

function sessionEvent(type: "session.created" | "session.deleted", sessionId: string) {
  return {
    type,
    properties: {
      info: {
        id: sessionId,
        projectID: "project-1",
        directory: "/repo",
        title: `Session ${sessionId}`,
        version: "1",
        time: {
          created: 0,
          updated: 0
        }
      }
    }
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

    // 순서: task-start (a), unsupported-gap rule (a), task-start (b), unsupported-gap rule (b),
    //        terminal-command (a), terminal-command (b), session-end (a), session-end (b)
    expect(calls.filter(c => c.endpoint === "/api/task-start")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/rule")).toHaveLength(0);
    expect(calls.filter(c => c.endpoint === "/api/terminal-command")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/session-end")).toHaveLength(2);
    // 태스크가 세션 종료 시 complete 되어서는 안 된다
    expect(calls.filter(c => c.endpoint === "/api/task-complete")).toHaveLength(0);


    // session-end 가 세션별로 올바른 taskId/sessionId를 사용한다
    const sessionEndBodies = calls
      .filter(c => c.endpoint === "/api/session-end")
      .map(c => c.body);
    expect(sessionEndBodies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: "task-session-a",
        sessionId: "monitor-session-a",
        metadata: expect.objectContaining({ opencodeSessionId: "session-a" })
      }),
      expect.objectContaining({
        taskId: "task-session-b",
        sessionId: "monitor-session-b",
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
      taskKind: "background",
      parentTaskId: "task-parent-session",
      backgroundTaskId: "bg-1"
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
});
