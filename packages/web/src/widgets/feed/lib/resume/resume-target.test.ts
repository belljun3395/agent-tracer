import { describe, expect, it } from "vitest";
import type { TaskId } from "~web/shared/identity.js";
import type { TaskDetailResponse } from "~web/entities/task/model/task-query.js";
import { selectResumeTarget } from "~web/widgets/feed/lib/resume/resume-target.js";

function makeDetail(overrides: Partial<TaskDetailResponse>): TaskDetailResponse {
  return {
    task: {
      id: "task-1" as TaskId,
      title: "hello",
      slug: "hello" as TaskDetailResponse["task"]["slug"],
      status: "running",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    timeline: [],
    ...overrides,
  };
}

describe("selectResumeTarget", () => {
  it("서버가 내려준 resumeTarget을 우선 사용한다", () => {
    const detail = makeDetail({
      sessions: [
        {
          id: "monitor-session",
          taskId: "task-1",
          runtimeSource: "claude-plugin",
          runtimeSessionId: "runtime-from-session",
          status: "active",
          summary: null,
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: null,
        },
      ],
      resumeTarget: {
        taskId: "task-1",
        runtimeSource: "claude-plugin",
        runtimeSessionId: "runtime-from-target",
        workspacePath: "/repo",
      },
    });

    expect(selectResumeTarget(detail)?.runtimeSessionId).toBe("runtime-from-target");
  });

  it("resumeTarget이 없으면 최신 세션의 런타임 세션 ID를 사용한다", () => {
    const detail = makeDetail({
      sessions: [
        {
          id: "monitor-session-new",
          taskId: "task-1",
          runtimeSource: "claude-plugin",
          runtimeSessionId: "runtime-new",
          status: "active",
          summary: null,
          startedAt: "2026-01-01T01:00:00.000Z",
          endedAt: null,
        },
      ],
    });

    expect(selectResumeTarget(detail)).toMatchObject({
      taskId: "task-1",
      runtimeSource: "claude-plugin",
      runtimeSessionId: "runtime-new",
    });
  });

  it("Codex 플러그인 세션도 resume 대상으로 사용한다", () => {
    const detail = makeDetail({
      sessions: [
        {
          id: "monitor-session-codex",
          taskId: "task-1",
          runtimeSource: "codex-plugin",
          runtimeSessionId: "codex-runtime-session",
          status: "active",
          summary: null,
          startedAt: "2026-01-01T01:00:00.000Z",
          endedAt: null,
        },
      ],
    });

    expect(selectResumeTarget(detail)).toMatchObject({
      taskId: "task-1",
      runtimeSource: "codex-plugin",
      runtimeSessionId: "codex-runtime-session",
    });
  });

  it("turn의 내부 sessionId는 resume 값으로 사용하지 않는다", () => {
    const detail = makeDetail({
      turns: [
        {
          id: "turn-1",
          sessionId: "monitor-session-not-runtime",
          taskId: "task-1",
          turnIndex: 1,
          status: "open",
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: null,
          aggregateVerdict: null,
          rulesEvaluatedCount: 0,
        },
      ],
    });

    expect(selectResumeTarget(detail)).toBeNull();
  });

  it("지원하지 않는 runtimeSource는 resume 대상으로 노출하지 않는다", () => {
    const detail = makeDetail({
      sessions: [
        {
          id: "monitor-session",
          taskId: "task-1",
          runtimeSource: "shell",
          runtimeSessionId: "runtime-session",
          status: "active",
          summary: null,
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: null,
        },
      ],
    });

    expect(selectResumeTarget(detail)).toBeNull();
  });
});
