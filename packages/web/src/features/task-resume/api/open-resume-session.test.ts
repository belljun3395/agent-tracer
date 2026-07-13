import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResumeTargetDto } from "@monitor/kernel";
import { openResumeSession } from "~web/features/task-resume/api/open-resume-session.js";

const target: ResumeTargetDto = {
  taskId: "task-1",
  runtimeSource: "claude-plugin",
  runtimeSessionId: "runtime-session-1",
  workspacePath: "/repo",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("openResumeSession", () => {
  it("로컬 helper가 응답하면 클립보드에 복사하지 않는다", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await openResumeSession(target, {
      helperBaseUrl: "http://127.0.0.1:3848",
      token: "local-resume-token",
    });

    expect(result.status).toBe("opened");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3848/api/v1/resume",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-agent-tracer-resume-token": "local-resume-token",
        }),
        body: JSON.stringify(target),
      }),
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it("helper가 인증을 거부하면 헤더 없이 시도한 명령을 복사한다", async () => {
    vi.stubEnv("VITE_AGENT_TRACER_RESUME_TOKEN", undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 401 }),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await openResumeSession(target, {
      helperBaseUrl: "http://127.0.0.1:3848",
    });

    expect(result.status).toBe("copied");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("x-agent-tracer-resume-token");
    expect(writeText).toHaveBeenCalledWith(
      "cd '/repo' && claude --resume 'runtime-session-1'",
    );
  });

  it("로컬 helper에 접속할 수 없으면 같은 resume 명령을 복사한다", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("helper down"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await openResumeSession(target, {
      helperBaseUrl: "http://127.0.0.1:3848",
    });

    expect(result.status).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "cd '/repo' && claude --resume 'runtime-session-1'",
    );
  });

  it("로컬 helper가 성공 응답을 주지 않으면 resume 명령을 복사한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 200 }),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await openResumeSession(target, {
      helperBaseUrl: "http://127.0.0.1:3848",
    });

    expect(result.status).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "cd '/repo' && claude --resume 'runtime-session-1'",
    );
  });
});
