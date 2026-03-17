import { describe, expect, it } from "vitest";

import type { RulesIndex, TimelineEvent } from "../types.js";
import {
  buildCompactInsight,
  buildObservabilityStats,
  buildRuleCoverage,
  buildTaskDisplayTitle,
  buildTaskExtraction,
  buildTagInsights,
  eventHasRuleGap,
  filterTimelineEvents
} from "./insights.js";

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: overrides.id ?? "event-1",
    taskId: overrides.taskId ?? "task-1",
    kind: overrides.kind ?? "tool.used",
    lane: overrides.lane ?? "implementation",
    title: overrides.title ?? "Event",
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

describe("buildRuleCoverage", () => {
  it("combines configured rules with observed rule events", () => {
    const rulesIndex: RulesIndex = {
      version: 1,
      rules: [
        {
          id: "backend",
          title: "Backend Rule",
          lane: "implementation",
          prefixes: [],
          keywords: [],
          tags: ["backend"]
        }
      ]
    };

    const timeline = [
      makeEvent({
        id: "configured-match",
        classification: {
          lane: "implementation",
          tags: ["backend"],
          matches: [
            {
              ruleId: "backend",
              source: "rules-index",
              score: 7,
              lane: "implementation",
              tags: ["backend"],
              reasons: [{ kind: "keyword", value: "service" }]
            }
          ]
        }
      }),
      makeEvent({
        id: "runtime-rule",
        kind: "rule.logged",
        lane: "rules",
        metadata: {
          ruleId: "c5",
          ruleStatus: "violation"
        }
      })
    ];

    const coverage = buildRuleCoverage(rulesIndex, timeline);

    expect(coverage[0]).toMatchObject({
      ruleId: "backend",
      configured: true,
      matchCount: 1
    });
    expect(coverage[1]).toMatchObject({
      ruleId: "c5",
      configured: false,
      ruleEventCount: 1,
      violationCount: 1
    });
  });
});

describe("buildTagInsights", () => {
  it("aggregates tags with lane and rule references", () => {
    const timeline = [
      makeEvent({
        id: "event-1",
        lane: "exploration",
        createdAt: "2026-03-16T12:00:00.000Z",
        metadata: { ruleId: "c5" },
        classification: {
          lane: "exploration",
          tags: ["rule:c5", "status:violation"],
          matches: []
        }
      }),
      makeEvent({
        id: "event-2",
        lane: "rules",
        createdAt: "2026-03-16T12:05:00.000Z",
        classification: {
          lane: "rules",
          tags: ["rule:c5"],
          matches: []
        }
      })
    ];

    const tagInsights = buildTagInsights(timeline);
    const c5 = tagInsights.find((tag) => tag.tag === "rule:c5");

    expect(c5).toMatchObject({
      count: 2,
      lanes: ["exploration", "rules"],
      ruleIds: ["c5"],
      lastSeenAt: "2026-03-16T12:05:00.000Z"
    });
  });
});

describe("buildCompactInsight", () => {
  it("summarizes compact handoff and marker events", () => {
    const timeline = [
      makeEvent({
        id: "compact-handoff",
        kind: "context.saved",
        lane: "planning",
        title: "Codex compact handoff",
        body: "Carry forward the active implementation notes.",
        createdAt: "2026-03-16T12:00:00.000Z",
        metadata: {
          compactEvent: true,
          compactPhase: "handoff",
          compactEventType: "context_compacted",
          compactSignals: ["context_compacted"]
        },
        classification: {
          lane: "planning",
          tags: ["compact", "compact:handoff", "compact:context-compacted"],
          matches: []
        }
      }),
      makeEvent({
        id: "compact-event",
        kind: "context.saved",
        lane: "planning",
        title: "Context compacted",
        body: "Codex emitted a compact-related after_agent payload.",
        createdAt: "2026-03-16T12:02:00.000Z",
        metadata: {
          compactEvent: true,
          compactPhase: "event",
          compactEventType: "context_compacted",
          compactSignals: ["context_compacted"]
        },
        classification: {
          lane: "planning",
          tags: ["compact", "compact:event", "compact:context-compacted"],
          matches: []
        }
      })
    ];

    expect(buildCompactInsight(timeline)).toMatchObject({
      occurrences: 1,
      handoffCount: 1,
      eventCount: 1,
      lastSeenAt: "2026-03-16T12:02:00.000Z",
      latestTitle: "Context compacted",
      tagFacets: ["compact:context-compacted", "compact:event", "compact:handoff"]
    });
  });
});

describe("buildObservabilityStats", () => {
  it("includes compact occurrence counts", () => {
    const timeline = [
      makeEvent({ kind: "action.logged" }),
      makeEvent({
        id: "check",
        kind: "verification.logged",
        metadata: { verificationStatus: "pass" }
      })
    ];

    expect(buildObservabilityStats(timeline, 3, 2)).toEqual({
      actions: 1,
      exploredFiles: 3,
      checks: 1,
      violations: 0,
      passes: 1,
      compactions: 2
    });
  });
});

describe("buildTaskExtraction", () => {
  it("derives a reusable objective and process from the selected task timeline", () => {
    const task = {
      id: "task-1",
      title: "Enhance Baden task extraction",
      slug: "enhance-baden-task-extraction",
      status: "running",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:10:00.000Z",
      workspacePath: "/workspace"
    } as const;

    const timeline = [
      makeEvent({
        id: "explore",
        lane: "exploration",
        kind: "tool.used",
        title: "Inspect task detail view",
        body: "Reviewed the current inspector cards and task badges."
      }),
      makeEvent({
        id: "plan",
        lane: "planning",
        kind: "plan.logged",
        title: "Plan extraction card",
        metadata: { action: "plan_task_extraction_card" }
      }),
      makeEvent({
        id: "implement",
        lane: "implementation",
        kind: "action.logged",
        title: "Implement task extraction card",
        body: "Added copyable task brief and process markdown output."
      }),
      makeEvent({
        id: "verify",
        lane: "rules",
        kind: "verification.logged",
        title: "Run build",
        metadata: { result: "PASS build" }
      }),
      makeEvent({
        id: "rule",
        lane: "rules",
        kind: "rule.logged",
        title: "Check extraction rule",
        metadata: { ruleId: "ux", ruleStatus: "pass", severity: "medium" }
      })
    ];

    const extraction = buildTaskExtraction(task, timeline, [
      {
        path: "/workspace/packages/web/src/App.tsx",
        count: 2,
        lastSeenAt: "2026-03-16T12:08:00.000Z"
      }
    ]);

    expect(extraction.objective).toBe("Enhance Baden task extraction");
    expect(extraction.sections.map((section) => section.lane)).toEqual([
      "exploration",
      "planning",
      "implementation",
      "rules"
    ]);
    expect(extraction.validations).toEqual([
      "Run build: PASS build",
      "ux pass (medium)"
    ]);
    expect(extraction.rules).toEqual(["ux"]);
    expect(extraction.brief).toContain("Process:");
    expect(extraction.processMarkdown).toContain("## Process");
    expect(extraction.processMarkdown).toContain("### Validate and enforce rules");
  });

  it("ignores generic agent-workspace titles when a better task objective exists", () => {
    const task = {
      id: "task-2",
      title: "Codex - ai-cli-monitoring",
      slug: "codex-ai-cli-monitoring",
      status: "running",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:10:00.000Z",
      workspacePath: "/workspace/ai-cli-monitoring"
    } as const;

    const timeline = [
      makeEvent({
        id: "start",
        kind: "task.start",
        lane: "user",
        title: "Codex - ai-cli-monitoring",
        body: "Make task titles editable from the dashboard."
      })
    ];

    const extraction = buildTaskExtraction(task, timeline, []);

    expect(extraction.objective).toBe("Make task titles editable from the dashboard.");
  });
});

describe("buildTaskDisplayTitle", () => {
  it("prefers an inferred title when the stored task title is a generic agent-workspace label", () => {
    const task = {
      id: "task-3",
      title: "Codex - ai-cli-monitoring",
      slug: "codex-ai-cli-monitoring",
      status: "running",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:10:00.000Z",
      workspacePath: "/workspace/ai-cli-monitoring"
    } as const;

    const timeline = [
      makeEvent({
        id: "start",
        kind: "task.start",
        lane: "user",
        title: "Codex - ai-cli-monitoring",
        body: "Improve the dashboard task title UX."
      })
    ];

    expect(buildTaskDisplayTitle(task, timeline)).toBe("Improve the dashboard task title UX.");
  });

  it("does not let agent session boilerplate override an OpenCode task title", () => {
    const task = {
      id: "task-4a",
      title: "OpenCode - agent-tracer",
      slug: "opencode-agent-tracer",
      status: "running",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:10:00.000Z",
      workspacePath: "/workspace/agent-tracer"
    } as const;

    const timeline = [
      makeEvent({
        id: "start",
        kind: "task.start",
        lane: "user",
        title: "OpenCode - agent-tracer",
        body: "Claude Code session started. Project: agent-tracer Path: /workspace/agent-tracer Session: abc123"
      })
    ];

    expect(buildTaskDisplayTitle(task, timeline)).toBe("OpenCode - agent-tracer");
  });

  it("still prefers a real user goal over a generic agent-workspace title", () => {
    const task = {
      id: "task-4b",
      title: "OpenCode - agent-tracer",
      slug: "opencode-agent-tracer",
      status: "running",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:10:00.000Z",
      workspacePath: "/workspace/agent-tracer"
    } as const;

    const timeline = [
      makeEvent({
        id: "user-goal",
        kind: "context.saved",
        lane: "user",
        title: "User request",
        body: "Fix the monitor title so OpenCode sessions are labeled correctly."
      }),
      makeEvent({
        id: "start",
        kind: "task.start",
        lane: "user",
        title: "OpenCode - agent-tracer",
        body: "Claude Code session started. Project: agent-tracer Path: /workspace/agent-tracer Session: abc123"
      })
    ];

    expect(buildTaskDisplayTitle(task, timeline)).toBe("Fix the monitor title so OpenCode sessions are labeled correctly.");
  });

  it("keeps a custom stored task title when it is already meaningful", () => {
    const task = {
      id: "task-4",
      title: "Improve title editing UX",
      slug: "improve-title-editing-ux",
      status: "running",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:10:00.000Z",
      workspacePath: "/workspace/ai-cli-monitoring"
    } as const;

    expect(buildTaskDisplayTitle(task, [])).toBe("Improve title editing UX");
  });
});

describe("filterTimelineEvents", () => {
  const laneFilters = {
    user: true,
    exploration: true,
    planning: true,
    implementation: true,
    rules: true
  } as const;

  it("filters by selected tag, rule, and rule gaps", () => {
    const ruleMatched = makeEvent({
      id: "matched",
      classification: {
        lane: "implementation",
        tags: ["backend"],
        matches: [
          {
            ruleId: "backend",
            source: "rules-index",
            score: 5,
            lane: "implementation",
            tags: ["backend"],
            reasons: [{ kind: "keyword", value: "service" }]
          }
        ]
      }
    });
    const gapEvent = makeEvent({
      id: "gap",
      lane: "rules",
      kind: "rule.logged",
      metadata: { ruleId: "c5" },
      classification: {
        lane: "rules",
        tags: ["rule:c5"],
        matches: []
      }
    });

    expect(
      filterTimelineEvents([ruleMatched, gapEvent], {
        laneFilters,
        selectedRuleId: "backend"
      }).map((event) => event.id)
    ).toEqual(["matched"]);

    expect(
      filterTimelineEvents([ruleMatched, gapEvent], {
        laneFilters,
        selectedTag: "rule:c5"
      }).map((event) => event.id)
    ).toEqual(["gap"]);

    expect(eventHasRuleGap(gapEvent)).toBe(true);
    expect(
      filterTimelineEvents([ruleMatched, gapEvent], {
        laneFilters,
        showRuleGapsOnly: true
      }).map((event) => event.id)
    ).toEqual(["gap"]);
  });
});

describe("buildObservabilityStats - 엣지케이스", () => {
  it("이벤트가 없으면 모든 카운트가 0이다", () => {
    const stats = buildObservabilityStats([], 0, 0);

    expect(stats).toEqual({
      actions: 0,
      exploredFiles: 0,
      checks: 0,
      violations: 0,
      passes: 0,
      compactions: 0
    });
  });

  it("rule.logged fix-applied는 pass로 집계된다", () => {
    const timeline = [
      makeEvent({
        id: "fix",
        kind: "rule.logged",
        lane: "rules",
        metadata: { ruleId: "r1", ruleStatus: "fix-applied" }
      })
    ];

    const stats = buildObservabilityStats(timeline, 0);

    expect(stats.passes).toBe(1);
    expect(stats.violations).toBe(0);
  });

  it("rule.logged check는 checks 카운트에 포함된다", () => {
    const timeline = [
      makeEvent({
        id: "chk",
        kind: "rule.logged",
        lane: "rules",
        metadata: { ruleStatus: "check" }
      })
    ];

    const stats = buildObservabilityStats(timeline, 0);

    expect(stats.checks).toBe(1);
    expect(stats.violations).toBe(0);
  });
});

describe("collectExploredFiles - 엣지케이스", () => {
  it("file.changed 이벤트는 파일 목록에 포함되지 않는다 (간접 검증)", () => {
    const timeline = [
      makeEvent({
        id: "changed",
        kind: "file.changed",
        lane: "exploration",
        metadata: { filePaths: ["/src/app.ts"] }
      })
    ];

    // collectExploredFiles는 file.changed를 제외하므로 exploredFiles 카운트는 0
    const stats = buildObservabilityStats(timeline, 0);
    expect(stats.exploredFiles).toBe(0);
  });
});

describe("buildRuleCoverage - 엣지케이스", () => {
  it("rulesIndex가 null이면 런타임 규칙만 집계한다", () => {
    const timeline = [
      makeEvent({
        id: "r1",
        kind: "rule.logged",
        lane: "rules",
        metadata: { ruleId: "dynamic-rule", ruleStatus: "violation" }
      })
    ];

    const coverage = buildRuleCoverage(null, timeline);

    expect(coverage).toHaveLength(1);
    expect(coverage[0]).toMatchObject({
      ruleId: "dynamic-rule",
      configured: false,
      violationCount: 1
    });
  });

  it("이벤트가 없으면 설정된 규칙만 반환되며 카운트는 0이다", () => {
    const rulesIndex: RulesIndex = {
      version: 1,
      rules: [
        {
          id: "empty-rule",
          title: "Empty Rule",
          lane: "rules",
          prefixes: [],
          keywords: [],
          tags: []
        }
      ]
    };

    const coverage = buildRuleCoverage(rulesIndex, []);

    expect(coverage).toHaveLength(1);
    expect(coverage[0]).toMatchObject({
      ruleId: "empty-rule",
      matchCount: 0,
      violationCount: 0,
      passCount: 0
    });
  });
});

describe("buildTagInsights - 엣지케이스", () => {
  it("이벤트가 없으면 빈 배열 반환", () => {
    expect(buildTagInsights([])).toHaveLength(0);
  });

  it("태그 없는 이벤트는 집계되지 않는다", () => {
    const timeline = [
      makeEvent({
        id: "no-tags",
        classification: { lane: "implementation", tags: [], matches: [] }
      })
    ];

    expect(buildTagInsights(timeline)).toHaveLength(0);
  });

  it("같은 태그가 여러 이벤트에 있으면 count가 합산된다", () => {
    const timeline = [
      makeEvent({
        id: "t1",
        lane: "implementation",
        createdAt: "2026-03-16T09:00:00.000Z",
        classification: { lane: "implementation", tags: ["shared-tag"], matches: [] }
      }),
      makeEvent({
        id: "t2",
        lane: "rules",
        createdAt: "2026-03-16T09:01:00.000Z",
        classification: { lane: "rules", tags: ["shared-tag"], matches: [] }
      })
    ];

    const insights = buildTagInsights(timeline);
    const shared = insights.find((t) => t.tag === "shared-tag");

    expect(shared?.count).toBe(2);
    expect(shared?.lanes).toContain("implementation");
    expect(shared?.lanes).toContain("rules");
  });
});

describe("buildCompactInsight - 엣지케이스", () => {
  it("compact 이벤트가 없으면 occurrences가 0이다", () => {
    const timeline = [
      makeEvent({ id: "normal", kind: "tool.used" })
    ];

    const insight = buildCompactInsight(timeline);

    expect(insight.occurrences).toBe(0);
    expect(insight.handoffCount).toBe(0);
    expect(insight.eventCount).toBe(0);
  });

  it("이벤트가 없으면 모든 카운트가 0이고 tagFacets가 빈 배열이다", () => {
    const insight = buildCompactInsight([]);

    expect(insight.occurrences).toBe(0);
    expect(insight.tagFacets).toHaveLength(0);
    expect(insight.lastSeenAt).toBeUndefined();
  });
});

describe("filterTimelineEvents - 엣지케이스", () => {
  const allLanes = {
    user: true,
    exploration: true,
    planning: true,
    implementation: true,
    rules: true
  } as const;

  it("레인 필터를 false로 설정하면 해당 레인 이벤트가 제외된다", () => {
    const timeline = [
      makeEvent({ id: "impl", lane: "implementation" }),
      makeEvent({ id: "user", lane: "user" })
    ];

    const result = filterTimelineEvents(timeline, {
      laneFilters: { ...allLanes, implementation: false }
    });

    expect(result.map((e) => e.id)).toEqual(["user"]);
  });

  it("이벤트가 없으면 빈 배열을 반환한다", () => {
    const result = filterTimelineEvents([], { laneFilters: allLanes });

    expect(result).toHaveLength(0);
  });

  it("모든 레인 필터가 false면 빈 배열을 반환한다", () => {
    const timeline = [
      makeEvent({ id: "e1", lane: "implementation" })
    ];

    const result = filterTimelineEvents(timeline, {
      laneFilters: {
        user: false,
        exploration: false,
        planning: false,
        implementation: false,
        rules: false
      }
    });

    expect(result).toHaveLength(0);
  });
});
