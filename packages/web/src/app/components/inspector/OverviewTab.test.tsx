import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventId, TaskId, type TimelineEventRecord } from "../../../types.js";
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
                        breakdown: []
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

    it("renders token usage telemetry", () => {
        const tokenUsageEvent: TimelineEventRecord = {
            id: EventId("event-token-usage"),
            taskId: TaskId("task-1"),
            kind: "token.usage",
            lane: "telemetry",
            title: "Token usage",
            metadata: {
                inputTokens: 1200,
                outputTokens: 340,
                cacheReadTokens: 50,
                cacheCreateTokens: 10,
                costUsd: 0.0123,
                durationMs: 250,
                model: "gpt-test",
            },
            classification: { lane: "telemetry", tags: [], matches: [] },
            createdAt: "2026-04-24T00:00:00.000Z",
        };
        const markup = renderToStaticMarkup(
            <OverviewTab
                observability={null}
                subagentInsight={{
                    delegations: 0,
                    backgroundTransitions: 0,
                    linkedBackgroundEvents: 0,
                    uniqueAsyncTasks: 0,
                    completedAsyncTasks: 0,
                    unresolvedAsyncTasks: 0
                }}
                timeline={[tokenUsageEvent]}
            />
        );

        expect(markup).toContain("Token Usage");
        expect(markup).toContain("gpt-test");
        expect(markup).toContain("1,600");
    });
});
