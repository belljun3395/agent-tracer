import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  MonitoringSession,
  MonitoringTask,
  TimelineEvent
} from "@monitor/core";

import {
  analyzeObservabilityOverview,
  analyzeTaskObservability
} from "../../src/application/observability.js";

function makeClassification(lane: EventClassification["lane"], tags: readonly string[] = []): EventClassification {
  return {
    lane,
    tags,
    matches: []
  };
}

function makeTask(overrides: Partial<MonitoringTask> = {}): MonitoringTask {
  return {
    id: "task-1",
    title: "Observability Task",
    slug: "observability-task",
    status: "completed",
    createdAt: "2026-03-27T00:00:00.000Z",
    updatedAt: "2026-03-27T00:06:00.000Z",
    taskKind: "primary",
    runtimeSource: "codex-cli",
    ...overrides
  };
}

function makeSession(overrides: Partial<MonitoringSession> = {}): MonitoringSession {
  return {
    id: "session-1",
    taskId: "task-1",
    status: "completed",
    startedAt: "2026-03-27T00:00:00.000Z",
    endedAt: "2026-03-27T00:06:00.000Z",
    ...overrides
  };
}

function makeEvent(
  id: string,
  kind: TimelineEvent["kind"],
  lane: TimelineEvent["lane"],
  createdAt: string,
  metadata: Record<string, unknown> = {},
  tags: readonly string[] = [],
  sessionId?: string
): TimelineEvent {
  return {
    id,
    taskId: "task-1",
    kind,
    lane,
    title: id,
    metadata,
    classification: makeClassification(lane, tags),
    createdAt,
    ...(sessionId ? { sessionId } : {})
  };
}

describe("observability read model", () => {
  it("summarizes task duration, coverage, and focus signals", () => {
    const task = makeTask();
    const sessions = [
      makeSession({
        id: "session-1",
        startedAt: "2026-03-27T00:00:00.000Z",
        endedAt: "2026-03-27T00:03:00.000Z"
      }),
      makeSession({
        id: "session-2",
        startedAt: "2026-03-27T00:03:30.000Z",
        endedAt: "2026-03-27T00:06:00.000Z"
      })
    ];
    const timeline: TimelineEvent[] = [
      makeEvent("evt-1", "task.start", "planning", "2026-03-27T00:00:00.000Z"),
      makeEvent(
        "evt-2",
        "user.message",
        "user",
        "2026-03-27T00:00:10.000Z",
        { captureMode: "raw", phase: "initial" }
      ),
      makeEvent(
        "evt-3",
        "question.logged",
        "questions",
        "2026-03-27T00:00:20.000Z",
        { questionId: "q-1", questionPhase: "asked" }
      ),
      makeEvent(
        "evt-4",
        "question.logged",
        "questions",
        "2026-03-27T00:00:30.000Z",
        { questionId: "q-1", questionPhase: "concluded" }
      ),
      makeEvent(
        "evt-5",
        "todo.logged",
        "todos",
        "2026-03-27T00:00:40.000Z",
        { todoId: "todo-1", todoState: "added" }
      ),
      makeEvent(
        "evt-6",
        "todo.logged",
        "todos",
        "2026-03-27T00:00:50.000Z",
        { todoId: "todo-1", todoState: "completed" }
      ),
      makeEvent(
        "evt-7",
        "plan.logged",
        "planning",
        "2026-03-27T00:01:00.000Z",
        {
          workItemId: "work-1",
          goalId: "goal-1",
          planId: "plan-1",
          handoffId: "handoff-1",
          filePaths: ["src/a.ts"],
          relatedEventIds: ["evt-8"]
        },
        ["planning", "design"]
      ),
      makeEvent(
        "evt-8",
        "action.logged",
        "implementation",
        "2026-03-27T00:04:00.000Z",
        {
          parentEventId: "evt-7",
          workItemId: "work-1",
          filePaths: ["src/a.ts", "src/b.ts"]
        },
        ["implementation", "edit"],
        "session-2"
      ),
      makeEvent(
        "evt-9",
        "verification.logged",
        "rules",
        "2026-03-27T00:04:30.000Z",
        { result: "ok", status: "passed" },
        ["verification"]
      ),
      makeEvent(
        "evt-10",
        "rule.logged",
        "rules",
        "2026-03-27T00:04:40.000Z",
        { ruleStatus: "violation", severity: "warn", rulePolicy: "block", ruleOutcome: "blocked" },
        ["verification"]
      ),
      makeEvent(
        "evt-11",
        "agent.activity.logged",
        "coordination",
        "2026-03-27T00:04:50.000Z",
        {
          workItemId: "work-1",
          goalId: "goal-1",
          planId: "plan-1",
          handoffId: "handoff-1",
          relationType: "implements"
        },
        ["coordination"]
      ),
      makeEvent(
        "evt-12",
        "action.logged",
        "background",
        "2026-03-27T00:05:00.000Z",
        { asyncTaskId: "bg-1", filePaths: ["src/bg.ts"] },
        ["background"],
        "session-2"
      )
    ];

    const summary = analyzeTaskObservability({ task, sessions, timeline, now: new Date("2026-03-27T00:06:00.000Z") });

    expect(summary.runtimeSource).toBe("codex-cli");
    expect(summary.totalEvents).toBe(12);
    expect(summary.activeDurationMs).toBeLessThan(summary.totalDurationMs);
    expect(summary.traceLinkCount).toBe(1);
    expect(summary.traceLinkedEventCount).toBe(2);
    expect(summary.traceLinkEligibleEventCount).toBe(6);
    expect(summary.traceLinkCoverageRate).toBeCloseTo(2 / 6);
    expect(summary.actionRegistryGapCount).toBe(4);
    expect(summary.actionRegistryEligibleEventCount).toBe(4);
    expect(summary.signals.rawUserMessages).toBe(1);
    expect(summary.signals.questionsAsked).toBe(1);
    expect(summary.signals.questionClosureRate).toBe(1);
    expect(summary.signals.todosAdded).toBe(1);
    expect(summary.signals.todoCompletionRate).toBe(1);
    expect(summary.signals.backgroundTransitions).toBe(1);
    expect(summary.signals.coordinationActivities).toBe(1);
    expect(summary.sessions).toEqual({ total: 2, resumed: 1, open: 0 });
    expect(summary.focus.topFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "src/a.ts" })
      ])
    );
    expect(summary.focus.topTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "verification" }),
        expect.objectContaining({ tag: "coordination" })
      ])
    );
    expect(summary.evidence.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "self_reported", count: expect.any(Number) }),
        expect.objectContaining({ level: "inferred", count: expect.any(Number) })
      ])
    );
    expect(summary.evidence.defaultLevel).toBe("self_reported");
    expect(summary.evidence.summary).toContain("cooperative self-reporting");
    expect(summary.evidence.runtimeCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "tool_activity",
          level: "self_reported",
          automatic: false
        })
      ])
    );
    expect(summary.rules).toEqual({
      total: 1,
      checks: 0,
      passes: 0,
      violations: 1,
      other: 0
    });
    expect(summary.ruleEnforcement).toEqual(expect.objectContaining({
      warnings: 0,
      blocked: 1,
      approvalRequested: 0,
      approved: 0,
      rejected: 0,
      bypassed: 0,
      activeState: "blocked"
    }));
    expect(summary.phaseBreakdown).toHaveLength(5);
    expect(summary.phaseBreakdown.some((phase) => phase.phase === "waiting")).toBe(false);
  });

  it("summarizes overview across runtime sources and stale running tasks", () => {
    const taskA = makeTask({
      id: "task-1",
      title: "Primary",
      updatedAt: "2026-03-27T00:06:00.000Z"
    });
    const taskB = makeTask({
      id: "task-2",
      title: "Background",
      status: "running",
      taskKind: "background",
      runtimeSource: "manual-mcp",
      createdAt: "2026-03-26T22:00:00.000Z",
      updatedAt: "2026-03-26T22:05:00.000Z",
      slug: "background"
    });
    const sessionsByTaskId = new Map<string, readonly MonitoringSession[]>([
      ["task-1", [
        makeSession({
          id: "session-1",
          taskId: "task-1",
          startedAt: "2026-03-27T00:00:00.000Z",
          endedAt: "2026-03-27T00:06:00.000Z"
        })
      ]],
      ["task-2", []]
    ]);
    const timelinesByTaskId = new Map<string, readonly TimelineEvent[]>([
      ["task-1", [
        makeEvent("evt-1", "user.message", "user", "2026-03-27T00:00:10.000Z", { captureMode: "raw" }),
        makeEvent("evt-2", "plan.logged", "planning", "2026-03-27T00:00:20.000Z", { relatedEventIds: ["evt-3"] }),
        makeEvent("evt-3", "action.logged", "implementation", "2026-03-27T00:04:00.000Z", { parentEventId: "evt-2" }, ["implementation"], "session-1"),
        makeEvent("evt-4", "question.logged", "questions", "2026-03-27T00:00:30.000Z", { questionId: "q-1", questionPhase: "concluded" }),
        makeEvent("evt-5", "todo.logged", "todos", "2026-03-27T00:00:40.000Z", { todoId: "todo-1", todoState: "completed" }),
        makeEvent("evt-6", "agent.activity.logged", "coordination", "2026-03-27T00:05:00.000Z", { workItemId: "work-1" }, ["coordination"]),
        makeEvent("evt-7", "action.logged", "background", "2026-03-27T00:05:10.000Z", { asyncTaskId: "bg-1" }, ["background"])
      ]],
      ["task-2", [
        makeEvent(
          "evt-8",
          "action.logged",
          "background",
          "2026-03-26T22:05:00.000Z",
          { asyncTaskId: "bg-2" },
          ["background"],
          undefined
        )
      ]]
    ]);

    const overview = analyzeObservabilityOverview({
      tasks: [taskA, taskB],
      sessionsByTaskId,
      timelinesByTaskId,
      now: new Date("2026-03-27T01:00:00.000Z")
    });

    expect(overview.totalTasks).toBe(2);
    expect(overview.runningTasks).toBe(1);
    expect(overview.staleRunningTasks).toBe(1);
    expect(overview.promptCaptureRate).toBe(0.5);
    expect(overview.traceLinkedTaskRate).toBe(0.5);
    expect(overview.tasksWithQuestions).toBe(1);
    expect(overview.tasksWithTodos).toBe(1);
    expect(overview.tasksWithCoordination).toBe(1);
    expect(overview.tasksWithBackground).toBe(2);
    expect(overview.runtimeSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runtimeSource: "codex-cli",
          taskCount: 1,
          promptCaptureRate: 1,
          traceLinkedTaskRate: 1
        }),
        expect.objectContaining({
          runtimeSource: "manual-mcp",
          taskCount: 1,
          promptCaptureRate: 0,
          traceLinkedTaskRate: 0
        })
      ])
    );
  });
});
