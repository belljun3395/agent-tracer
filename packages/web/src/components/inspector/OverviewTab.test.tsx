import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskId } from "@monitor/core";
import { OverviewTab } from "./OverviewTab.js";

describe("OverviewTab", () => {
    it("keeps top files and removes top tags", () => {
        const markup = renderToStaticMarkup(
            <OverviewTab
                observability={{
                    taskId: TaskId("task-1"),
                    totalDurationMs: 120000,
                    activeDurationMs: 60000,
                    totalEvents: 12,
                    traceLinkCount: 0,
                    traceLinkedEventCount: 0,
                    traceLinkEligibleEventCount: 0,
                    traceLinkCoverageRate: 0,
                    actionRegistryGapCount: 0,
                    actionRegistryEligibleEventCount: 0,
                    phaseBreakdown: [],
                    sessions: { total: 1, resumed: 0, open: 1 },
                    signals: {
                        rawUserMessages: 1,
                        followUpMessages: 0,
                        questionsAsked: 0,
                        questionsClosed: 0,
                        questionClosureRate: 0,
                        todosAdded: 0,
                        todosCompleted: 0,
                        todoCompletionRate: 0,
                        thoughts: 1,
                        toolCalls: 2,
                        terminalCommands: 1,
                        verifications: 1,
                        coordinationActivities: 0,
                        backgroundTransitions: 0,
                        exploredFiles: 2
                    },
                    focus: {
                        topFiles: [{ path: "/workspace/src/app.ts", count: 2 }],
                        topTags: [{ tag: "frontend", count: 3 }]
                    },
                    evidence: {
                        defaultLevel: "proven",
                        summary: "summary",
                        breakdown: [],
                        runtimeCoverage: []
                    },
                    rules: {
                        total: 0,
                        checks: 0,
                        passes: 0,
                        violations: 0,
                        other: 0
                    },
                    ruleEnforcement: {
                        warnings: 0,
                        blocked: 0,
                        approvalRequested: 0,
                        approved: 0,
                        rejected: 0,
                        bypassed: 0,
                        activeState: "clear",
                        activeRuleId: undefined,
                        activeLabel: undefined
                    }
                }}
                subagentInsight={{
                    delegations: 0,
                    backgroundTransitions: 0,
                    linkedBackgroundEvents: 0,
                    uniqueAsyncTasks: 0,
                    completedAsyncTasks: 0,
                    unresolvedAsyncTasks: 0
                }}
                workspacePath="/workspace"
            />
        );

        expect(markup).toContain("Top Files");
        expect(markup).not.toContain("Top Tags");
    });
});
