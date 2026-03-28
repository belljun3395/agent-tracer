import { describe, expect, it } from "vitest";

import type { MonitoringTask, TimelineEvent } from "../types.js";
import {
  buildHandoffMarkdown,
  buildHandoffPlain,
  buildHandoffXML,
  buildHandoffSystemPrompt,
  buildInspectorEventTitle,
  buildObservabilityStats,
  buildQuestionGroups,
  buildTaskDisplayTitle,
  buildTodoGroups,
  collectViolationDescriptions,
  collectWebLookups,
  filterTimelineEvents
} from "./insights.js";
import type { HandoffOptions } from "./insights.js";

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

describe("buildInspectorEventTitle", () => {
  it("긴 search mode 안내문을 짧은 inspector 제목으로 바꾼다", () => {
    const event = makeEvent({
      kind: "user.message",
      lane: "user",
      title: "[search-mode]\nMAXIMIZE SEARCH EFFORT. Launch multiple background agents IN PARALLEL."
    });

    expect(buildInspectorEventTitle(event)).toBe("Search mode instructions");
  });

  it("저장된 displayTitle override를 우선 사용한다", () => {
    const event = makeEvent({
      kind: "user.message",
      lane: "user",
      title: "[CONTEXT]: User requested to read README.md, run a shell echo command, add and remove a comment.",
      metadata: { displayTitle: "README check and revert" }
    });

    expect(buildInspectorEventTitle(event)).toBe("README check and revert");
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

  it("uses title as the violation description", () => {
    const timeline = [
      makeEvent({ kind: "verification.logged", title: "Specific error", metadata: { verificationStatus: "fail" } })
    ];
    expect(collectViolationDescriptions(timeline)).toEqual(["Specific error"]);
  });

  it("filters out non-violation events from a mixed timeline", () => {
    const timeline = [
      makeEvent({ kind: "tool.used", title: "Read file", metadata: {} }),
      makeEvent({ kind: "verification.logged", title: "Check failed", metadata: { verificationStatus: "fail" } }),
      makeEvent({ kind: "verification.logged", title: "Check passed", metadata: { verificationStatus: "pass" } }),
    ];
    expect(collectViolationDescriptions(timeline)).toEqual(["Check failed"]);
  });

  it("returns empty array for empty timeline", () => {
    expect(collectViolationDescriptions([])).toEqual([]);
  });
});

function makeHandoff(overrides: Partial<HandoffOptions> = {}): HandoffOptions {
  const defaultInclude = {
    summary: true, plans: true, process: true, files: true, modifiedFiles: true,
    todos: true, violations: true, questions: false
  };
  return {
    objective: "Build the feature",
    summary: "Implemented X and Y",
    plans: ["Design the data model", "Implement API endpoints"],
    sections: [{ lane: "implementation" as const, title: "Implementation", items: ["Did A", "Did B"] }],
    exploredFiles: ["src/App.tsx", "src/lib/insights.ts"],
    modifiedFiles: ["src/App.tsx"],
    openTodos: ["Write tests"],
    openQuestions: ["Should we use Redux?"],
    violations: ["No console.log allowed"],
    memo: "Start from the tests",
    include: { ...defaultInclude, ...(overrides.include ?? {}) },
    ...overrides
  };
}

describe("buildHandoffPlain", () => {
  it("includes all enabled sections when fully populated", () => {
    const result = buildHandoffPlain(makeHandoff());
    expect(result).toContain("Task: Build the feature");
    expect(result).toContain("Summary: Implemented X and Y");
    expect(result).toContain("Process:");
    expect(result).toContain("- implementation: Did A");
    expect(result).toContain("Explored Files: src/App.tsx, src/lib/insights.ts");
    expect(result).toContain("Modified Files: src/App.tsx");
    expect(result).toContain("Open TODOs:");
    expect(result).toContain("- Write tests");
    expect(result).toContain("Violations:");
    expect(result).toContain("- No console.log allowed");
    expect(result).toContain("Note: Start from the tests");
  });

  it("excludes questions when include.questions = false", () => {
    const result = buildHandoffPlain(makeHandoff());
    expect(result).not.toContain("Open Questions:");
  });

  it("includes questions when include.questions = true", () => {
    const result = buildHandoffPlain(makeHandoff({ include: { summary: true, plans: true, process: true, files: true, modifiedFiles: true, todos: true, violations: true, questions: true } }));
    expect(result).toContain("Open Questions:");
    expect(result).toContain("- Should we use Redux?");
  });

  it("omits summary when include.summary = false", () => {
    const result = buildHandoffPlain(makeHandoff({ include: { summary: false, plans: true, process: true, files: true, modifiedFiles: true, todos: true, violations: true, questions: false } }));
    expect(result).not.toContain("Summary:");
  });

  it("omits process when include.process = false", () => {
    const result = buildHandoffPlain(makeHandoff({ include: { summary: true, plans: true, process: false, files: true, modifiedFiles: true, todos: true, violations: true, questions: false } }));
    expect(result).not.toContain("Process:");
  });

  it("omits process when sections array is empty", () => {
    const result = buildHandoffPlain(makeHandoff({ sections: [] }));
    expect(result).not.toContain("Process:");
  });

  it("omits note line when memo is blank", () => {
    const result = buildHandoffPlain(makeHandoff({ memo: "" }));
    expect(result).not.toContain("Note:");
  });

  it("omits explored files when include.files = false", () => {
    const result = buildHandoffPlain(makeHandoff({ include: { summary: true, plans: true, process: true, files: false, modifiedFiles: true, todos: true, violations: true, questions: false } }));
    expect(result).not.toContain("Explored Files:");
  });

  it("omits explored files when array is empty", () => {
    const result = buildHandoffPlain(makeHandoff({ exploredFiles: [] }));
    expect(result).not.toContain("Explored Files:");
  });

  it("always includes objective regardless of toggles", () => {
    const result = buildHandoffPlain(makeHandoff({
      include: { summary: false, plans: false, process: false, files: false, modifiedFiles: false, todos: false, violations: false, questions: false }
    }));
    expect(result).toContain("Task: Build the feature");
  });
});

describe("buildHandoffMarkdown", () => {
  it("produces markdown structure for all enabled sections", () => {
    const result = buildHandoffMarkdown(makeHandoff());
    expect(result).toContain("# Task Context");
    expect(result).toContain("## Objective\nBuild the feature");
    expect(result).toContain("## Summary\nImplemented X and Y");
    expect(result).toContain("## Process\n### Implementation\n- Did A\n- Did B");
    expect(result).toContain("## Explored Files\n- `src/App.tsx`\n- `src/lib/insights.ts`");
    expect(result).toContain("## Modified Files\n- `src/App.tsx`");
    expect(result).toContain("## Open TODOs\n- Write tests");
    expect(result).toContain("## Violations\n- No console.log allowed");
    expect(result).toContain("## Handoff Note\nStart from the tests");
  });

  it("omits questions section when include.questions = false", () => {
    const result = buildHandoffMarkdown(makeHandoff());
    expect(result).not.toContain("## Open Questions");
  });

  it("includes questions when include.questions = true", () => {
    const result = buildHandoffMarkdown(makeHandoff({
      include: { summary: true, plans: true, process: true, files: true, modifiedFiles: true, todos: true, violations: true, questions: true }
    }));
    expect(result).toContain("## Open Questions\n- Should we use Redux?");
  });

  it("omits sections with no content", () => {
    const result = buildHandoffMarkdown(makeHandoff({ openTodos: [], violations: [] }));
    expect(result).not.toContain("## Open TODOs");
    expect(result).not.toContain("## Violations");
  });

  it("omits handoff note section when memo is blank", () => {
    const result = buildHandoffMarkdown(makeHandoff({ memo: "" }));
    expect(result).not.toContain("## Handoff Note");
  });

  it("always includes objective", () => {
    const result = buildHandoffMarkdown(makeHandoff({
      include: { summary: false, plans: false, process: false, files: false, modifiedFiles: false, todos: false, violations: false, questions: false }
    }));
    expect(result).toContain("## Objective\nBuild the feature");
  });
});

describe("buildHandoffXML", () => {
  it("produces valid XML structure with CDATA wrappers", () => {
    const result = buildHandoffXML(makeHandoff());
    expect(result).toContain("<context>");
    expect(result).toContain("</context>");
    expect(result).toContain("<objective><![CDATA[Build the feature]]></objective>");
    expect(result).toContain("<summary><![CDATA[Implemented X and Y]]></summary>");
    expect(result).toContain("<process>");
    expect(result).toContain('lane="implementation"');
    expect(result).toContain("<step><![CDATA[Did A]]></step>");
    expect(result).toContain("<explored_files>");
    expect(result).toContain("<file><![CDATA[src/App.tsx]]></file>");
    expect(result).toContain("<modified_files>");
    expect(result).toContain("<open_todos>");
    expect(result).toContain("<todo><![CDATA[Write tests]]></todo>");
    expect(result).toContain('<violations count="1">');
    expect(result).toContain("<violation><![CDATA[No console.log allowed]]></violation>");
    expect(result).toContain("<handoff_note><![CDATA[Start from the tests]]></handoff_note>");
  });

  it("omits questions when include.questions = false", () => {
    const result = buildHandoffXML(makeHandoff());
    expect(result).not.toContain("<open_questions>");
  });

  it("includes questions when enabled", () => {
    const result = buildHandoffXML(makeHandoff({
      include: { summary: true, plans: true, process: true, files: true, modifiedFiles: true, todos: true, violations: true, questions: true }
    }));
    expect(result).toContain("<open_questions>");
    expect(result).toContain("<question><![CDATA[Should we use Redux?]]></question>");
  });

  it("omits empty sections entirely", () => {
    const result = buildHandoffXML(makeHandoff({ openTodos: [] }));
    expect(result).not.toContain("<open_todos>");
  });

  it("omits handoff_note when memo is blank", () => {
    const result = buildHandoffXML(makeHandoff({ memo: "" }));
    expect(result).not.toContain("<handoff_note>");
  });
});

describe("buildHandoffSystemPrompt", () => {
  it("starts with the continuity preamble", () => {
    const result = buildHandoffSystemPrompt(makeHandoff());
    expect(result).toContain("You are continuing a software development task");
  });

  it("includes objective under ## Task", () => {
    const result = buildHandoffSystemPrompt(makeHandoff());
    expect(result).toContain("## Task\nBuild the feature");
  });

  it("includes todos under ## What still needs to be done", () => {
    const result = buildHandoffSystemPrompt(makeHandoff());
    expect(result).toContain("## What still needs to be done\n- Write tests");
  });

  it("includes violations under ## Watch out for", () => {
    const result = buildHandoffSystemPrompt(makeHandoff());
    expect(result).toContain("## Watch out for\n- No console.log allowed");
  });

  it("ends with acknowledgement request", () => {
    const result = buildHandoffSystemPrompt(makeHandoff());
    expect(result).toContain("Begin by acknowledging you have read this context");
  });

  it("omits empty sections", () => {
    const result = buildHandoffSystemPrompt(makeHandoff({ openTodos: [] }));
    expect(result).not.toContain("## What still needs to be done");
  });

  it("omits note section when memo is blank", () => {
    const result = buildHandoffSystemPrompt(makeHandoff({ memo: "" }));
    expect(result).not.toContain("## Note from previous session");
  });
});

describe("collectWebLookups", () => {
  function makeWebEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
    return makeEvent({
      kind: "tool.used",
      lane: "exploration",
      title: "WebSearch: typescript generics",
      body: "Web lookup: typescript generics",
      metadata: { toolName: "WebSearch", webUrls: ["typescript generics"] },
      ...overrides
    });
  }

  it("returns empty array when no events", () => {
    expect(collectWebLookups([])).toEqual([]);
  });

  it("ignores exploration events without webUrls", () => {
    const event = makeWebEvent({ metadata: { toolName: "Read", filePaths: ["foo.ts"] } });
    expect(collectWebLookups([event])).toEqual([]);
  });

  it("ignores non-exploration lane events", () => {
    const event = makeWebEvent({ lane: "implementation" });
    expect(collectWebLookups([event])).toEqual([]);
  });

  it("collects a WebSearch event as a WebLookupStat", () => {
    const event = makeWebEvent();
    const result = collectWebLookups([event]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      url: "typescript generics",
      toolName: "WebSearch",
      count: 1
    });
  });

  it("deduplicates same URL and increments count", () => {
    const e1 = makeWebEvent({ id: "e1", createdAt: "2026-01-01T00:00:00.000Z" });
    const e2 = makeWebEvent({ id: "e2", createdAt: "2026-01-01T01:00:00.000Z" });
    const result = collectWebLookups([e1, e2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(2);
    expect(result[0]!.lastSeenAt).toBe("2026-01-01T01:00:00.000Z");
    expect(result[0]!.firstSeenAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles WebFetch events", () => {
    const event = makeWebEvent({
      title: "WebFetch: https://example.com",
      metadata: { toolName: "WebFetch", webUrls: ["https://example.com"] }
    });
    const result = collectWebLookups([event]);
    expect(result[0]!.toolName).toBe("WebFetch");
    expect(result[0]!.url).toBe("https://example.com");
  });

  it("sorts by lastSeenAt descending (most recent first)", () => {
    const e1 = makeWebEvent({
      id: "e1",
      title: "WebSearch: older",
      metadata: { toolName: "WebSearch", webUrls: ["older query"] },
      createdAt: "2026-01-01T00:00:00.000Z"
    });
    const e2 = makeWebEvent({
      id: "e2",
      title: "WebSearch: newer",
      metadata: { toolName: "WebSearch", webUrls: ["newer query"] },
      createdAt: "2026-01-02T00:00:00.000Z"
    });
    const result = collectWebLookups([e1, e2]);
    expect(result[0]!.url).toBe("newer query");
    expect(result[1]!.url).toBe("older query");
  });

  it("tracks firstSeenAt and lastSeenAt correctly for single event", () => {
    const event = makeWebEvent({ createdAt: "2026-03-01T10:00:00.000Z" });
    const result = collectWebLookups([event]);
    expect(result[0]!.firstSeenAt).toBe("2026-03-01T10:00:00.000Z");
    expect(result[0]!.lastSeenAt).toBe("2026-03-01T10:00:00.000Z");
  });
});
