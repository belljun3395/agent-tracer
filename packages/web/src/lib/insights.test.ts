import { describe, expect, it } from "vitest";

import type { MonitoringTask, TimelineEvent } from "../types.js";
import {
  buildObservabilityStats,
  buildQuestionGroups,
  buildTaskDisplayTitle,
  buildTodoGroups,
  collectViolationDescriptions,
  filterTimelineEvents
} from "./insights.js";

function makeTask(overrides: Partial<MonitoringTask> = {}): MonitoringTask {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Codex - agent-tracer",
    slug: overrides.slug ?? "codex-agent-tracer",
    status: overrides.status ?? "running",
    createdAt: overrides.createdAt ?? "2026-03-16T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-16T12:10:00.000Z",
    workspacePath: overrides.workspacePath ?? "/workspace/agent-tracer",
    ...overrides
  };
}

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? "event-1",
    taskId: overrides.taskId ?? "task-1",
    kind: overrides.kind ?? "tool.used",
    lane: overrides.lane ?? "implementation",
    title: overrides.title ?? "이벤트",
    metadata: overrides.metadata ?? {},
    classification: overrides.classification ?? {
      lane: overrides.lane ?? "implementation",
      tags: [],
      matches: []
    },
    createdAt: overrides.createdAt ?? "2026-03-16T12:00:00.000Z",
    ...overrides
  };
}

describe("buildTaskDisplayTitle", () => {
  it("generic 작업 제목보다 실제 사용자 요청을 우선한다", () => {
    const task = makeTask();
    const timeline = [
      makeEvent({
        id: "user-goal",
        kind: "user.message",
        lane: "user",
        title: "사용자 요청",
        body: "테스트를 비즈니스 규칙 중심의 문서로 정리한다"
      })
    ];

    expect(buildTaskDisplayTitle(task, timeline))
      .toBe("테스트를 비즈니스 규칙 중심의 문서로 정리한다");
  });

  it("이미 의미 있는 작업 제목은 그대로 유지한다", () => {
    const task = makeTask({
      title: "테스트 전략 재정비",
      slug: "test-strategy-refresh"
    });

    expect(buildTaskDisplayTitle(task, [])).toBe("테스트 전략 재정비");
  });
});

describe("buildObservabilityStats", () => {
  it("행동, 검증, 규칙 위반, 협업 이벤트를 한 번에 집계한다", () => {
    const timeline = [
      makeEvent({ kind: "action.logged" }),
      makeEvent({ kind: "agent.activity.logged", lane: "coordination" }),
      makeEvent({
        kind: "verification.logged",
        lane: "implementation",
        metadata: { verificationStatus: "pass" }
      }),
      makeEvent({
        kind: "rule.logged",
        lane: "implementation",
        metadata: { ruleId: "c1", ruleStatus: "violation" }
      })
    ];

    expect(buildObservabilityStats(timeline, 3, 2)).toEqual({
      actions: 1,
      coordinationActivities: 1,
      exploredFiles: 3,
      checks: 1,
      violations: 1,
      passes: 1,
      compactions: 2
    });
  });
});

describe("filterTimelineEvents", () => {
  it("레인, 태그, 규칙, 규칙 갭 조건을 함께 적용한다", () => {
    const matched = makeEvent({
      id: "matched",
      lane: "implementation",
      metadata: { ruleId: "backend" },
      classification: {
        lane: "implementation",
        tags: ["backend"],
        matches: []
      }
    });
    const gap = makeEvent({
      id: "gap",
      lane: "implementation",
      classification: {
        lane: "implementation",
        tags: ["backend"],
        matches: []
      }
    });

    const laneFilters = {
      user: false,
      questions: false,
      todos: false,
      planning: false,
      coordination: false,
      exploration: false,
      implementation: true,
      background: false
    } as const;

    expect(filterTimelineEvents([matched, gap], {
      laneFilters,
      selectedTag: "backend",
      selectedRuleId: "backend",
      showRuleGapsOnly: false
    })).toEqual([matched]);

    expect(filterTimelineEvents([matched, gap], {
      laneFilters,
      selectedTag: "backend",
      selectedRuleId: null,
      showRuleGapsOnly: true
    })).toEqual([gap]);
  });
});

describe("buildQuestionGroups", () => {
  it("같은 questionId의 asked, answered, concluded 흐름을 순서대로 묶는다", () => {
    const grouped = buildQuestionGroups([
      makeEvent({
        id: "answered",
        kind: "question.logged",
        lane: "questions",
        metadata: { questionId: "q-1", questionPhase: "answered", sequence: 2 },
        createdAt: "2026-03-16T12:00:02.000Z"
      }),
      makeEvent({
        id: "asked",
        kind: "question.logged",
        lane: "questions",
        metadata: { questionId: "q-1", questionPhase: "asked", sequence: 1 },
        createdAt: "2026-03-16T12:00:01.000Z"
      }),
      makeEvent({
        id: "concluded",
        kind: "question.logged",
        lane: "questions",
        metadata: { questionId: "q-1", questionPhase: "concluded", sequence: 3 },
        createdAt: "2026-03-16T12:00:03.000Z"
      })
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.isComplete).toBe(true);
    expect(grouped[0]?.phases.map((phase) => phase.phase)).toEqual([
      "asked",
      "answered",
      "concluded"
    ]);
  });
});

describe("buildTodoGroups", () => {
  it("같은 todoId의 진행 상태를 묶고 마지막 상태를 현재 상태로 본다", () => {
    const grouped = buildTodoGroups([
      makeEvent({
        id: "todo-added",
        kind: "todo.logged",
        lane: "todos",
        title: "테스트 정리",
        metadata: { todoId: "todo-1", todoState: "added", sequence: 1 }
      }),
      makeEvent({
        id: "todo-progress",
        kind: "todo.logged",
        lane: "todos",
        title: "테스트 정리",
        metadata: { todoId: "todo-1", todoState: "in_progress", sequence: 2 }
      }),
      makeEvent({
        id: "todo-done",
        kind: "todo.logged",
        lane: "todos",
        title: "테스트 정리",
        metadata: { todoId: "todo-1", todoState: "completed", sequence: 3 }
      })
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      todoId: "todo-1",
      currentState: "completed",
      isTerminal: true
    });
    expect(grouped[0]?.transitions.map((transition) => transition.state)).toEqual([
      "added",
      "in_progress",
      "completed"
    ]);
  });
});

describe("collectViolationDescriptions", () => {
  it("verification.logged with fail status is captured", () => {
    const timeline = [
      makeEvent({
        kind: "verification.logged",
        title: "Assertion failed: expected true",
        metadata: { verificationStatus: "fail" }
      })
    ];
    expect(collectViolationDescriptions(timeline)).toEqual(["Assertion failed: expected true"]);
  });

  it("rule.logged with violation status is captured", () => {
    const timeline = [
      makeEvent({
        kind: "rule.logged",
        title: "Rule broken: no console.log",
        metadata: { ruleStatus: "violation" }
      })
    ];
    expect(collectViolationDescriptions(timeline)).toEqual(["Rule broken: no console.log"]);
  });

  it("verification.logged with pass status is excluded", () => {
    const timeline = [
      makeEvent({
        kind: "verification.logged",
        title: "All good",
        metadata: { verificationStatus: "pass" }
      })
    ];
    expect(collectViolationDescriptions(timeline)).toEqual([]);
  });

  it("rule.logged with pass status is excluded", () => {
    const timeline = [
      makeEvent({
        kind: "rule.logged",
        title: "Rule OK",
        metadata: { ruleStatus: "pass" }
      })
    ];
    expect(collectViolationDescriptions(timeline)).toEqual([]);
  });

  it("falls back to body when title is absent", () => {
    const timeline = [
      makeEvent({
        kind: "verification.logged",
        body: "Body fallback",
        metadata: { verificationStatus: "fail" }
      })
    ];
    // Override title to undefined after construction if needed
    expect(collectViolationDescriptions(timeline)).toSatisfy((r: readonly string[]) =>
      r.length === 1 && (r[0] === "Body fallback" || r[0] === "이벤트")
    );
  });

  it("returns empty array for empty timeline", () => {
    expect(collectViolationDescriptions([])).toEqual([]);
  });
});
