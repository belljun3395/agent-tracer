import { describe, expect, it } from "vitest";
import { EventId, TaskId, TaskSlug, WorkspacePath } from "@monitor/core";
import type { MonitoringTask, TimelineEvent } from "@monitor/web-core";
import { buildExplorationInsight, collectRecentRuleDecisions, buildTaskExtraction, buildSubagentInsight, buildHandoffMarkdown, buildHandoffPlain, buildHandoffXML, buildHandoffSystemPrompt, buildHandoffPrompt, buildEvaluatePrompt, buildInspectorEventTitle, buildObservabilityStats, buildQuestionGroups, buildTaskDisplayTitle, buildTodoGroups, collectPlanSteps, collectViolationDescriptions, collectWebLookups, filterTimelineEvents } from "@monitor/web-core";
import type { HandoffOptions, EvaluatePromptOptions } from "@monitor/web-core";
function makeTask(overrides: Omit<Partial<MonitoringTask>, "id"> & {
    id?: string;
} = {}): MonitoringTask {
    const { id, ...rest } = overrides;
    return {
        id: TaskId(id ?? "task-1"),
        title: rest.title ?? "Claude Code - agent-tracer",
        slug: rest.slug ?? TaskSlug("claude-code-agent-tracer"),
        status: rest.status ?? "running",
        createdAt: rest.createdAt ?? "2026-03-16T12:00:00.000Z",
        updatedAt: rest.updatedAt ?? "2026-03-16T12:10:00.000Z",
        workspacePath: rest.workspacePath ?? WorkspacePath("/workspace/agent-tracer"),
        ...rest
    };
}
type EventOverrides = Omit<Partial<TimelineEvent>, "id" | "taskId"> & {
    id?: string;
    taskId?: string;
};
function makeEvent(overrides: EventOverrides = {}): TimelineEvent {
    const { id, taskId, ...rest } = overrides;
    return {
        id: EventId(id ?? "event-1"),
        taskId: TaskId(taskId ?? "task-1"),
        kind: rest.kind ?? "tool.used",
        lane: rest.lane ?? "implementation",
        title: rest.title ?? "이벤트",
        metadata: rest.metadata ?? {},
        classification: rest.classification ?? {
            lane: rest.lane ?? "implementation",
            tags: [],
            matches: []
        },
        createdAt: rest.createdAt ?? "2026-03-16T12:00:00.000Z",
        ...rest
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
            slug: TaskSlug("test-strategy-refresh")
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
        purpose: "continue",
        mode: "full",
        snapshot: {
            objective: "Build the feature",
            originalRequest: "Please build the feature",
            outcomeSummary: "Implemented X and Y",
            approachSummary: "Started from the task snapshot and iterated on the API shape.",
            reuseWhen: null,
            watchItems: ["No console.log allowed"],
            keyDecisions: ["Did A", "Did B"],
            nextSteps: ["Write tests"],
            keyFiles: ["src/App.tsx", "src/lib/insights.ts"],
            modifiedFiles: ["src/App.tsx"],
            verificationSummary: "Checks: 1 (1 pass, 0 fail)",
            searchText: "Build the feature Implemented X and Y"
        },
        include: { ...defaultInclude, ...(overrides.include ?? {}) },
        ...overrides
    };
}
describe("buildHandoffPlain", () => {
    it("includes all enabled sections when fully populated", () => {
        const result = buildHandoffPlain(makeHandoff());
        expect(result).toContain("Briefing: Build the feature");
        expect(result).toContain("Purpose: Continue this task");
        expect(result).toContain("Current State: Open work remains: 1 todo.");
        expect(result).toContain("Summary: Implemented X and Y");
        expect(result).toContain("Process:");
        expect(result).toContain("- implementation: Did A");
        expect(result).toContain("Explored Files: src/App.tsx, src/lib/insights.ts");
        expect(result).toContain("Modified Files: src/App.tsx");
        expect(result).toContain("Open TODOs:");
        expect(result).toContain("- Write tests");
        expect(result).toContain("Watchouts:");
        expect(result).toContain("- No console.log allowed");
        expect(result).toContain("Memo: Start from the tests");
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
        expect(result).toContain("Briefing: Build the feature");
        expect(result).toContain("Current State:");
    });
    it("uses snapshot-driven compact mode for short handoff output", () => {
        const result = buildHandoffPlain(makeHandoff({
            mode: "compact",
            snapshot: {
                ...makeHandoff().snapshot,
                reuseWhen: "When you need a short AI handoff",
                watchItems: ["Keep the prompt under budget"]
            }
        }));
        expect(result).toContain("Mode: compact");
        expect(result).toContain("Reuse When: When you need a short AI handoff");
        expect(result).toContain("Verification: Checks: 1 (1 pass, 0 fail)");
    });
    it("reorders sections for review briefings", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "review" }));
        expect(result.indexOf("Summary:")).toBeLessThan(result.indexOf("Current State:"));
        expect(result.indexOf("Watchouts:")).toBeLessThan(result.indexOf("Process:"));
    });
    it("uses ready-for-review currentState text when openTodos is empty", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "review", openTodos: [] }));
        expect(result).toContain("The task is ready for review.");
    });
    it("omits todos section for review purpose", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "review" }));
        expect(result).not.toContain("Open TODOs:");
    });
    it("uses no-todos text when openTodos is empty for continue purpose", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "continue", openTodos: [] }));
        expect(result).toContain("No open todos were detected in the selected briefing view.");
    });
    it("compact mode with empty snapshot produces minimal output without empty sections", () => {
        const emptySnapshot = {
            objective: "Fix the bug",
            originalRequest: null,
            outcomeSummary: null,
            approachSummary: null,
            reuseWhen: null,
            watchItems: [] as readonly string[],
            keyDecisions: [] as readonly string[],
            nextSteps: [] as readonly string[],
            keyFiles: [] as readonly string[],
            modifiedFiles: [] as readonly string[],
            verificationSummary: null,
            searchText: ""
        };
        const result = buildHandoffPlain(makeHandoff({
            mode: "compact",
            snapshot: emptySnapshot,
            summary: "",
            plans: [],
            sections: [],
            exploredFiles: [],
            modifiedFiles: [],
            openTodos: [],
            violations: [],
            openQuestions: [],
            memo: ""
        }));
        expect(result).toContain("Briefing: Build the feature");
        expect(result).toContain("Current State:");
        expect(result).not.toContain("Summary:");
        expect(result).not.toContain("Plan:");
        expect(result).not.toContain("Process:");
        expect(result).not.toContain("Explored Files:");
    });
});
describe("buildHandoffPlain - handoff purpose", () => {
    it("reorders sections: summary appears before currentState", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "handoff" }));
        expect(result.indexOf("Summary:")).toBeLessThan(result.indexOf("Current State:"));
    });
    it("includes purpose label for handoff", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "handoff" }));
        expect(result).toContain("Purpose: Hand off to someone else");
    });
});
describe("buildHandoffPlain - reference purpose", () => {
    it("reorders sections: summary appears before reuseWhen before currentState", () => {
        const result = buildHandoffPlain(makeHandoff({
            purpose: "reference",
            snapshot: { ...makeHandoff().snapshot, reuseWhen: "When building similar features" }
        }));
        expect(result.indexOf("Summary:")).toBeLessThan(result.indexOf("Reuse When:"));
        expect(result.indexOf("Reuse When:")).toBeLessThan(result.indexOf("Current State:"));
    });
    it("uses reference-specific currentState text when openTodos is empty", () => {
        const result = buildHandoffPlain(makeHandoff({ purpose: "reference", openTodos: [] }));
        expect(result).toContain("This briefing captures the task as a reusable reference.");
    });
});
describe("buildHandoffMarkdown", () => {
    it("produces markdown structure for all enabled sections", () => {
        const result = buildHandoffMarkdown(makeHandoff());
        expect(result).toContain("# Briefing");
        expect(result).toContain("## Purpose\nContinue this task");
        expect(result).toContain("## Objective\nBuild the feature");
        expect(result).toContain("## Current State\nOpen work remains: 1 todo.");
        expect(result).toContain("## Summary\nImplemented X and Y");
        expect(result).toContain("## Process\n### Implementation\n- Did A\n- Did B");
        expect(result).toContain("## Explored Files\n- `src/App.tsx`\n- `src/lib/insights.ts`");
        expect(result).toContain("## Modified Files\n- `src/App.tsx`");
        expect(result).toContain("## Open TODOs\n- Write tests");
        expect(result).toContain("## Watchouts\n- No console.log allowed");
        expect(result).toContain("## Memo\nStart from the tests");
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
        expect(result).not.toContain("## Memo");
    });
    it("always includes objective", () => {
        const result = buildHandoffMarkdown(makeHandoff({
            include: { summary: false, plans: false, process: false, files: false, modifiedFiles: false, todos: false, violations: false, questions: false }
        }));
        expect(result).toContain("## Objective\nBuild the feature");
    });
    it("renders reuse and verification sections in compact mode when snapshot provides them", () => {
        const result = buildHandoffMarkdown(makeHandoff({
            mode: "compact",
            snapshot: {
                ...makeHandoff().snapshot,
                reuseWhen: "When workflow context keeps getting too long"
            }
        }));
        expect(result).toContain("## Detail Level\ncompact");
        expect(result).toContain("## Reuse When\nWhen workflow context keeps getting too long");
        expect(result).toContain("## Verification\n- Checks: 1 (1 pass, 0 fail)");
    });
    it("keeps full summary and plan text in full mode instead of injecting ellipsis", () => {
        const longSummary = "[README.md](/Users/example/project/README.md) 다시 읽었습니다. 현재 기준 핵심은 Agent Tracer를 다른 프로젝트에 붙여 쓰는 monitor server/MCP/hook/plugin 소스로 두는 쪽이 1차 목표라는 점이고, 외부 프로젝트용 실행 경로는 `npm install && npm run build && npm run dev:server`입니다.";
        const longPlan = "README refresh summary: README re-read complete. Key points: Agent Tracer is positioned primarily as an external-project integration via monitor server/MCP/hooks/plugins.";
        const extractedPlan = `README refresh summary: ${longPlan}`;
        const timeline = [
            makeEvent({
                id: "user-goal",
                kind: "user.message",
                lane: "user",
                title: "사용자 요청",
                body: "README.md 한번 다시 읽어봐."
            }),
            makeEvent({
                id: "planning-summary",
                kind: "context.saved",
                lane: "planning",
                title: "README refresh summary",
                body: longPlan
            }),
            makeEvent({
                id: "assistant-summary",
                kind: "assistant.response",
                lane: "user",
                title: "README reread summary",
                body: longSummary
            })
        ];
        const extraction = buildTaskExtraction(null, timeline, []);
        const plans = collectPlanSteps(timeline);
        const result = buildHandoffMarkdown(makeHandoff({
            summary: extraction.summary,
            plans,
            sections: extraction.sections,
            mode: "full"
        }));
        expect(extraction.summary).toBe(longSummary);
        expect(plans).toContain(extractedPlan);
        expect(result).toContain(longSummary);
        expect(result).toContain(extractedPlan);
        expect(result).not.toContain("npm install && npm…");
        expect(result).not.toContain("monitor server/MCP/hooks/plugins...");
    });
});
describe("buildHandoffXML", () => {
    it("produces valid XML structure with CDATA wrappers", () => {
        const result = buildHandoffXML(makeHandoff());
        expect(result).toContain("<briefing>");
        expect(result).toContain("</briefing>");
        expect(result).toContain("<objective><![CDATA[Build the feature]]></objective>");
        expect(result).toContain("<purpose><![CDATA[continue]]></purpose>");
        expect(result).toContain("<current_state><![CDATA[Open work remains: 1 todo.");
        expect(result).toContain("<summary><![CDATA[Implemented X and Y]]></summary>");
        expect(result).toContain("<process>");
        expect(result).toContain('lane="implementation"');
        expect(result).toContain("<step><![CDATA[Did A]]></step>");
        expect(result).toContain("<explored_files>");
        expect(result).toContain("<file><![CDATA[src/App.tsx]]></file>");
        expect(result).toContain("<modified_files>");
        expect(result).toContain("<open_todos>");
        expect(result).toContain("<todo><![CDATA[Write tests]]></todo>");
        expect(result).toContain('<watchouts count="1">');
        expect(result).toContain("<watchout><![CDATA[No console.log allowed]]></watchout>");
        expect(result).toContain("<memo><![CDATA[Start from the tests]]></memo>");
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
    it("omits memo when blank", () => {
        const result = buildHandoffXML(makeHandoff({ memo: "" }));
        expect(result).not.toContain("<memo>");
    });
});
describe("buildHandoffSystemPrompt", () => {
    it("starts with the continuity preamble", () => {
        const result = buildHandoffSystemPrompt(makeHandoff());
        expect(result).toContain("You are receiving a briefing for a software development task");
    });
    it("includes objective under ## Task", () => {
        const result = buildHandoffSystemPrompt(makeHandoff());
        expect(result).toContain("## Briefing Purpose\nContinue this task");
        expect(result).toContain("## Task\nBuild the feature");
    });
    it("includes todos under ## What still needs to be done", () => {
        const result = buildHandoffSystemPrompt(makeHandoff());
        expect(result).toContain("## What still needs to be done\n- Write tests");
    });
    it("includes violations under ## Watchouts", () => {
        const result = buildHandoffSystemPrompt(makeHandoff());
        expect(result).toContain("## Watchouts\n- No console.log allowed");
    });
    it("ends with acknowledgement request", () => {
        const result = buildHandoffSystemPrompt(makeHandoff());
        expect(result).toContain("Begin by acknowledging you have read this briefing");
    });
    it("omits empty sections", () => {
        const result = buildHandoffSystemPrompt(makeHandoff({ openTodos: [] }));
        expect(result).not.toContain("## What still needs to be done");
    });
    it("omits note section when memo is blank", () => {
        const result = buildHandoffSystemPrompt(makeHandoff({ memo: "" }));
        expect(result).not.toContain("## Memo");
    });
});
describe("collectWebLookups", () => {
    function makeWebEvent(overrides: EventOverrides = {}): TimelineEvent {
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
            count: 1,
            compactRelation: "no-compact"
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
    it("labels web lookups relative to the last compact boundary", () => {
        const compact = makeEvent({
            id: "compact-1",
            kind: "context.saved",
            lane: "planning",
            title: "Context compacted",
            createdAt: "2026-03-01T10:30:00.000Z",
            metadata: { compactPhase: "after" }
        });
        const before = makeWebEvent({
            id: "before",
            createdAt: "2026-03-01T10:00:00.000Z",
            metadata: { toolName: "WebSearch", webUrls: ["before query"] }
        });
        const after = makeWebEvent({
            id: "after",
            createdAt: "2026-03-01T11:00:00.000Z",
            metadata: { toolName: "WebSearch", webUrls: ["after query"] }
        });
        const result = collectWebLookups([before, compact, after]);
        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({ url: "before query", compactRelation: "before-compact" }),
            expect.objectContaining({ url: "after query", compactRelation: "after-compact" })
        ]));
    });
});
describe("exploration + subagent insights", () => {
    it("counts pre/post compact web lookups in exploration insight", () => {
        const compact = makeEvent({
            id: "compact-1",
            kind: "context.saved",
            lane: "planning",
            title: "Context compacted",
            createdAt: "2026-03-01T10:30:00.000Z",
            metadata: { compactPhase: "after" }
        });
        const before = makeEvent({
            id: "before",
            kind: "tool.used",
            lane: "exploration",
            title: "WebSearch before",
            createdAt: "2026-03-01T10:00:00.000Z",
            metadata: { toolName: "WebSearch", webUrls: ["before query"] }
        });
        const after = makeEvent({
            id: "after",
            kind: "tool.used",
            lane: "exploration",
            title: "WebSearch after",
            createdAt: "2026-03-01T11:00:00.000Z",
            metadata: { toolName: "WebSearch", webUrls: ["after query"] }
        });
        const lookups = collectWebLookups([before, compact, after]);
        const insight = buildExplorationInsight([before, compact, after], [], lookups);
        expect(insight.preCompactWebLookups).toBe(1);
        expect(insight.postCompactWebLookups).toBe(1);
        expect(insight.acrossCompactWebLookups).toBe(0);
    });
    it("summarizes delegation and async task linkage", () => {
        const timeline = [
            makeEvent({
                id: "delegation",
                kind: "agent.activity.logged",
                lane: "coordination",
                title: "Delegated background task",
                metadata: { activityType: "delegation" }
            }),
            makeEvent({
                id: "bg-1",
                kind: "action.logged",
                lane: "background",
                title: "Background task running",
                metadata: { asyncTaskId: "bg-task-1", parentSessionId: "sess-1" }
            }),
            makeEvent({
                id: "bg-2",
                kind: "action.logged",
                lane: "background",
                title: "Background task completed",
                metadata: { asyncTaskId: "bg-task-1", asyncStatus: "completed", parentSessionId: "sess-1" }
            })
        ];
        const insight = buildSubagentInsight(timeline);
        expect(insight.delegations).toBe(1);
        expect(insight.backgroundTransitions).toBe(2);
        expect(insight.linkedBackgroundEvents).toBe(2);
        expect(insight.uniqueAsyncTasks).toBe(1);
        expect(insight.completedAsyncTasks).toBe(1);
        expect(insight.unresolvedAsyncTasks).toBe(0);
    });
});
describe("collectRecentRuleDecisions", () => {
    it("returns recent rule decisions with reviewer notes and outcomes", () => {
        const decisions = collectRecentRuleDecisions([
            makeEvent({
                id: "rule-1",
                kind: "rule.logged",
                lane: "implementation",
                title: "Need approval before answer",
                createdAt: "2026-03-01T10:00:00.000Z",
                body: "Approved because this is a trusted repo",
                metadata: {
                    ruleId: "approval-gate",
                    ruleStatus: "pass",
                    ruleOutcome: "approved",
                    severity: "warn"
                }
            }),
            makeEvent({
                id: "rule-2",
                kind: "rule.logged",
                lane: "implementation",
                title: "Blocked dangerous command",
                createdAt: "2026-03-01T11:00:00.000Z",
                metadata: {
                    ruleId: "dangerous-command",
                    ruleStatus: "violation",
                    ruleOutcome: "blocked",
                    severity: "high"
                }
            })
        ]);
        expect(decisions[0]).toMatchObject({
            ruleId: "dangerous-command",
            outcome: "blocked"
        });
        expect(decisions[1]).toMatchObject({
            ruleId: "approval-gate",
            outcome: "approved",
            note: "Approved because this is a trusted repo"
        });
    });
});
describe("buildHandoffPrompt", () => {
    it("includes continue preamble and action for continue purpose", () => {
        const result = buildHandoffPrompt(makeHandoff({ purpose: "continue" }));
        expect(result).toContain("이전에 진행하던 작업을 이어받습니다");
        expect(result).toContain("가장 긴급한 미완료 항목부터 작업을 시작하세요");
    });
    it("includes handoff preamble for handoff purpose", () => {
        const result = buildHandoffPrompt(makeHandoff({ purpose: "handoff" }));
        expect(result).toContain("인수받습니다");
        expect(result).toContain("인수 사항을 확인하고");
    });
    it("includes review instruction for review purpose", () => {
        const result = buildHandoffPrompt(makeHandoff({ purpose: "review" }));
        expect(result).toContain("완료된 작업을 리뷰합니다");
        expect(result).toContain("품질 이슈나 개선점을 정리하세요");
    });
    it("includes MCP tool hint for reference purpose", () => {
        const result = buildHandoffPrompt(makeHandoff({ purpose: "reference" }));
        expect(result).toContain("monitor_find_similar_workflows");
    });
    it("includes objective in Task section", () => {
        const result = buildHandoffPrompt(makeHandoff());
        expect(result).toContain("## Task\nBuild the feature");
    });
    it("ends with Action section", () => {
        const result = buildHandoffPrompt(makeHandoff());
        expect(result).toContain("## Action\n");
    });
});
describe("buildEvaluatePrompt", () => {
    function makeEvaluateOptions(overrides: Partial<EvaluatePromptOptions> = {}): EvaluatePromptOptions {
        return {
            taskId: "task-abc-123",
            objective: "Fix TypeScript errors",
            summary: "Fixed 3 type errors in api.ts",
            sections: [],
            plans: [],
            exploredFiles: [],
            modifiedFiles: ["src/api.ts"],
            openTodos: [],
            openQuestions: [],
            violations: [],
            snapshot: makeHandoff().snapshot,
            ...overrides
        };
    }
    it("includes taskId literal in the instructions", () => {
        const result = buildEvaluatePrompt(makeEvaluateOptions());
        expect(result).toContain('"task-abc-123"');
    });
    it("includes monitor_evaluate_task tool name", () => {
        const result = buildEvaluatePrompt(makeEvaluateOptions());
        expect(result).toContain("monitor_evaluate_task");
    });
    it("includes evaluation field names", () => {
        const result = buildEvaluatePrompt(makeEvaluateOptions());
        expect(result).toContain("outcomeNote");
        expect(result).toContain("approachNote");
        expect(result).toContain("reuseWhen");
    });
    it("includes task context in output", () => {
        const result = buildEvaluatePrompt(makeEvaluateOptions());
        expect(result).toContain("Fix TypeScript errors");
        expect(result).toContain("Fixed 3 type errors in api.ts");
    });
    it("includes modified files when present", () => {
        const result = buildEvaluatePrompt(makeEvaluateOptions());
        expect(result).toContain("src/api.ts");
    });
    it("does not include modified files line when empty", () => {
        const result = buildEvaluatePrompt(makeEvaluateOptions({ modifiedFiles: [] }));
        expect(result).not.toContain("Modified files:");
    });
});
