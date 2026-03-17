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
    expect(calls.filter(c => c.endpoint === "/api/rule")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/terminal-command")).toHaveLength(2);
    expect(calls.filter(c => c.endpoint === "/api/session-end")).toHaveLength(2);
    // 태스크가 세션 종료 시 complete 되어서는 안 된다
    expect(calls.filter(c => c.endpoint === "/api/task-complete")).toHaveLength(0);

    // unsupported-gap rule이 올바른 ruleId를 사용한다
    const ruleCall = calls.find(c => c.endpoint === "/api/rule");
    expect(ruleCall?.body).toMatchObject({
      ruleId: "user-message-capture-unavailable",
      source: "opencode-plugin"
    });

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
    expect(calls.filter((call) => call.endpoint === "/api/task-start")).toHaveLength(1);
    expect(calls.filter((call) => call.endpoint === "/api/terminal-command")).toHaveLength(0);
  });
});
