import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMonitorHooks } from "../../../.opencode/plugins/monitor.ts";

interface RecordedRequest {
  readonly url: string;
  readonly body: unknown;
}

describe("OpenCode native question routing", () => {
  const requests: RecordedRequest[] = [];

  beforeEach(() => {
    requests.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, body });

      if (url.endsWith("/api/task-start")) {
        return {
          ok: true,
          json: async () => ({
            task: { id: "opencode-ses-test-1" },
            sessionId: "monitor-session-1"
          })
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ ok: true })
      } as Response;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("질문 도구 호출을 일반 tool 이벤트 대신 question 이벤트로 기록한다", async () => {
    const hooks = createMonitorHooks("/tmp/opencode-workspace");

    await hooks["tool.execute.after"]?.({
      sessionID: "ses-test-1",
      tool: "question",
      callID: "call-question-1",
      args: {
        questions: [
          {
            header: "What to open",
            question: "What should I open?",
            options: [
              { label: "Current project", description: "Open the current folder" }
            ]
          }
        ]
      }
    } as never, {
      title: "Asked 1 question",
      output: "User has answered your questions: \"What should I open?\"=\"Current project\".",
      metadata: {}
    } as never);

    const endpoints = requests.map((request) => new URL(request.url).pathname);
    expect(endpoints).toContain("/api/question");
    expect(endpoints).not.toContain("/api/tool-used");

    const questionBodies = requests
      .filter((request) => request.url.endsWith("/api/question"))
      .map((request) => request.body as Record<string, unknown>);

    expect(questionBodies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: "opencode-ses-test-1",
        sessionId: "monitor-session-1",
        questionPhase: "asked",
        title: "What should I open?"
      }),
      expect.objectContaining({
        taskId: "opencode-ses-test-1",
        sessionId: "monitor-session-1",
        questionPhase: "answered",
        title: "Answered: What should I open?"
      })
    ]));
  });
});
