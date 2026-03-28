import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMonitorRuntime } from "../../src/bootstrap/create-monitor-runtime.js";

describe("observability routes", () => {
  let app: Express;
  let closeServer: () => void;

  beforeEach(() => {
    const runtime = createMonitorRuntime({
      databasePath: ":memory:"
    });
    app = runtime.app;
    closeServer = () => runtime.close();
  });

  afterEach(() => closeServer());

  it("GET /api/tasks/:taskId/observability returns task-level diagnostics", async () => {
    const runtime = await request(app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "codex-cli",
        runtimeSessionId: "runtime-1",
        title: "Observability Route Task"
      });

    const taskId = runtime.body.taskId as string;
    const sessionId = runtime.body.sessionId as string;

    await request(app)
      .post("/api/task-start")
      .send({ title: "Secondary Task" });

    const raw = await request(app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId,
        messageId: "msg-1",
        captureMode: "raw",
        source: "codex-cli",
        phase: "initial",
        title: "Start"
      });
    const rawEventId = raw.body.events[0].id as string;

    const questionAsked = await request(app)
      .post("/api/question")
      .send({
        taskId,
        sessionId,
        questionId: "q-1",
        questionPhase: "asked",
        title: "Which phase?"
      });
    expect(questionAsked.status).toBe(200);

    await request(app)
      .post("/api/question")
      .send({
        taskId,
        sessionId,
        questionId: "q-1",
        questionPhase: "concluded",
        title: "Use planning"
      });

    await request(app)
      .post("/api/todo")
      .send({
        taskId,
        sessionId,
        todoId: "todo-1",
        todoState: "added",
        title: "Do the thing"
      });

    await request(app)
      .post("/api/todo")
      .send({
        taskId,
        sessionId,
        todoId: "todo-1",
        todoState: "completed",
        title: "Done"
      });

    const plan = await request(app)
      .post("/api/plan")
      .send({
        taskId,
        sessionId,
        action: "plan",
        title: "Plan the change",
        relatedEventIds: [rawEventId],
        workItemId: "work-1",
        goalId: "goal-1",
        planId: "plan-1",
        handoffId: "handoff-1",
        filePaths: ["src/observability.ts"]
      });
    const planEventId = plan.body.events[0].id as string;

    await request(app)
      .post("/api/action")
      .send({
        taskId,
        sessionId,
        action: "implement",
        title: "Implement the change",
        parentEventId: planEventId,
        filePaths: ["src/observability.ts", "src/observability.spec.ts"]
      });

    await request(app)
      .post("/api/agent-activity")
      .send({
        taskId,
        sessionId,
        activityType: "skill_use",
        title: "Use codex-monitor",
        skillName: "codex-monitor",
        skillPath: "skills/codex-monitor/SKILL.md",
        workItemId: "work-1",
        relationType: "implements"
      });

    const taskObservability = await request(app).get(`/api/tasks/${taskId}/observability`);

    expect(taskObservability.status).toBe(200);
    expect(taskObservability.body.observability.taskId).toBe(taskId);
    expect(taskObservability.body.observability.runtimeSource).toBe("codex-cli");
    expect(taskObservability.body.observability.totalEvents).toBeGreaterThan(0);
    expect(taskObservability.body.observability.sessions.total).toBe(1);
    expect(taskObservability.body.observability.traceLinkCount).toBe(5);
    expect(taskObservability.body.observability.traceLinkedEventCount).toBe(5);
    expect(taskObservability.body.observability.traceLinkEligibleEventCount).toBe(6);
    expect(taskObservability.body.observability.traceLinkCoverageRate).toBeCloseTo(5 / 6);
    expect(taskObservability.body.observability.actionRegistryGapCount).toBe(0);
    expect(taskObservability.body.observability.actionRegistryEligibleEventCount).toBe(2);
    expect(taskObservability.body.observability.signals.rawUserMessages).toBe(1);
    expect(taskObservability.body.observability.signals.questionClosureRate).toBe(1);
    expect(taskObservability.body.observability.signals.todoCompletionRate).toBe(1);
    expect(taskObservability.body.observability.focus.workItemIds).toContain("work-1");
    expect(taskObservability.body.observability.phaseBreakdown).toHaveLength(5);
    expect(taskObservability.body.observability.phaseBreakdown.some((phase: { phase: string }) => phase.phase === "waiting")).toBe(false);

    const overview = await request(app).get("/api/observability/overview");

    expect(overview.status).toBe(200);
    expect(overview.body.observability.totalTasks).toBe(2);
    expect(overview.body.observability.promptCaptureRate).toBe(0.5);
    expect(overview.body.observability.traceLinkedTaskRate).toBe(0.5);
    expect(overview.body.observability.runtimeSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runtimeSource: "codex-cli",
          taskCount: 1,
          traceLinkedTaskRate: 1
        }),
        expect.objectContaining({
          runtimeSource: "unknown",
          taskCount: 1,
          traceLinkedTaskRate: 0
        })
      ])
    );

    const appOverview = await request(app).get("/api/overview");

    expect(appOverview.status).toBe(200);
    expect(appOverview.body.observability.promptCaptureRate).toBe(0.5);
    expect(appOverview.body.observability.runtimeSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runtimeSource: "codex-cli",
          taskCount: 1,
          traceLinkedTaskRate: 1
        })
      ])
    );
  });
});
