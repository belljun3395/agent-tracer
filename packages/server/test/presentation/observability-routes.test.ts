import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNestMonitorRuntime } from "@monitor/server";
describe("observability routes", () => {
    let app: Awaited<ReturnType<typeof createNestMonitorRuntime>>["app"];
    let closeServer: () => Promise<void>;
    beforeEach(async () => {
        const runtime = await createNestMonitorRuntime({
            databasePath: ":memory:"
        });
        app = runtime.app;
        closeServer = () => runtime.close();
    });
    afterEach(async () => closeServer());
    it("GET /api/tasks/:taskId/observability returns task-level diagnostics", async () => {
        const runtime = await request(app)
            .post("/api/runtime-session-ensure")
            .send({
            runtimeSource: "claude-plugin",
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
            source: "claude-plugin",
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
            title: "Load monitor workflow",
            skillName: "monitor-workflow",
            skillPath: "packages/runtime-claude",
            workItemId: "work-1",
            relationType: "implements"
        });
        await request(app)
            .post("/api/rule")
            .send({
            taskId,
            sessionId,
            action: "check_rule",
            ruleId: "docs-first",
            severity: "warn",
            status: "violation",
            policy: "approval_required",
            outcome: "approval_requested",
            title: "Docs required before answer"
        });
        const taskObservability = await request(app).get(`/api/tasks/${taskId}/observability`);
        expect(taskObservability.status).toBe(200);
        expect(taskObservability.body.observability.taskId).toBe(taskId);
        expect(taskObservability.body.observability.runtimeSource).toBe("claude-plugin");
        expect(taskObservability.body.observability.totalEvents).toBeGreaterThan(0);
        expect(taskObservability.body.observability.sessions.total).toBe(1);
        expect(taskObservability.body.observability.traceLinkCount).toBe(5);
        expect(taskObservability.body.observability.traceLinkedEventCount).toBe(5);
        expect(taskObservability.body.observability.traceLinkEligibleEventCount).toBe(7);
        expect(taskObservability.body.observability.traceLinkCoverageRate).toBeCloseTo(5 / 7);
        expect(taskObservability.body.observability.actionRegistryGapCount).toBe(0);
        expect(taskObservability.body.observability.actionRegistryEligibleEventCount).toBe(3);
        expect(taskObservability.body.observability.signals.rawUserMessages).toBe(1);
        expect(taskObservability.body.observability.signals.questionClosureRate).toBe(1);
        expect(taskObservability.body.observability.signals.todoCompletionRate).toBe(1);
        expect(taskObservability.body.observability.evidence.defaultLevel).toBe("proven");
        expect(taskObservability.body.observability.evidence.summary).toContain("mechanically observed prompts");
        expect(taskObservability.body.observability.evidence.breakdown).toEqual(expect.arrayContaining([
            expect.objectContaining({ level: "self_reported", count: expect.any(Number) })
        ]));
        expect(taskObservability.body.observability.evidence.runtimeCoverage).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: "tool_activity",
                level: "proven",
                automatic: true
            }),
            expect.objectContaining({
                key: "subagents_background",
                level: "proven",
                automatic: true
            })
        ]));
        expect(taskObservability.body.observability.rules).toEqual({
            total: 1,
            checks: 0,
            passes: 0,
            violations: 1,
            other: 0
        });
        expect(taskObservability.body.observability.ruleEnforcement).toEqual(expect.objectContaining({
            warnings: 0,
            blocked: 0,
            approvalRequested: 1,
            approved: 0,
            rejected: 0,
            bypassed: 0,
            activeState: "approval_required",
            activeRuleId: "docs-first"
        }));
        const taskDetail = await request(app).get(`/api/tasks/${taskId}`);
        expect(taskDetail.body.task.status).toBe("waiting");
        expect(taskObservability.body.observability.focus.topFiles).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: "src/observability.ts" })
        ]));
        expect(taskObservability.body.observability.focus.topTags).toEqual(expect.arrayContaining([
            expect.objectContaining({ tag: "action-registry" }),
            expect.objectContaining({ tag: "question" })
        ]));
        expect(taskObservability.body.observability.phaseBreakdown).toHaveLength(5);
        expect(taskObservability.body.observability.phaseBreakdown.map((phase: {
            phase: string;
        }) => phase.phase)).not.toContain("waiting");
        const overview = await request(app).get("/api/observability/overview");
        const openinference = await request(app).get(`/api/tasks/${taskId}/openinference`);
        expect(openinference.status).toBe(200);
        expect(openinference.body.openinference.taskId).toBe(taskId);
        expect(openinference.body.openinference.spans).toEqual(expect.arrayContaining([
            expect.objectContaining({
                spanId: expect.any(String),
                attributes: expect.objectContaining({
                    "ai.monitor.event.kind": expect.any(String)
                })
            })
        ]));
        expect(overview.status).toBe(200);
        expect(overview.body.observability.totalTasks).toBe(2);
        expect(overview.body.observability.promptCaptureRate).toBe(0.5);
        expect(overview.body.observability.traceLinkedTaskRate).toBe(0.5);
        expect(overview.body.observability.runtimeSources).toEqual(expect.arrayContaining([
            expect.objectContaining({
                runtimeSource: "claude-plugin",
                taskCount: 1,
                traceLinkedTaskRate: 1
            }),
            expect.objectContaining({
                runtimeSource: "unknown",
                taskCount: 1,
                traceLinkedTaskRate: 0
            })
        ]));
        const appOverview = await request(app).get("/api/overview");
        expect(appOverview.status).toBe(200);
        expect(appOverview.body.observability.promptCaptureRate).toBe(0.5);
        expect(appOverview.body.observability.runtimeSources).toEqual(expect.arrayContaining([
            expect.objectContaining({
                runtimeSource: "claude-plugin",
                taskCount: 1,
                traceLinkedTaskRate: 1
            })
        ]));
    });
    it("updates task status from rule enforcement outcomes", async () => {
        const runtime = await request(app)
            .post("/api/runtime-session-ensure")
            .send({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "runtime-guard",
            title: "Rule Guard Task"
        });
        const taskId = runtime.body.taskId as string;
        const sessionId = runtime.body.sessionId as string;
        await request(app)
            .post("/api/rule")
            .send({
            taskId,
            sessionId,
            action: "guard_docs",
            ruleId: "docs-first",
            severity: "warn",
            status: "violation",
            policy: "approval_required",
            outcome: "approval_requested",
            title: "Approval required"
        })
            .expect(200);
        const waitingTask = await request(app).get(`/api/tasks/${taskId}`);
        expect(waitingTask.body.task.status).toBe("waiting");
        await request(app)
            .post("/api/rule")
            .send({
            taskId,
            sessionId,
            action: "approve_docs_exception",
            ruleId: "docs-first",
            severity: "warn",
            status: "pass",
            policy: "approval_required",
            outcome: "approved",
            title: "Approved"
        })
            .expect(200);
        const resumedTask = await request(app).get(`/api/tasks/${taskId}`);
        expect(resumedTask.body.task.status).toBe("running");
        await request(app)
            .post("/api/rule")
            .send({
            taskId,
            sessionId,
            action: "block_unsafe_completion",
            ruleId: "unsafe-complete",
            severity: "high",
            status: "violation",
            policy: "block",
            outcome: "blocked",
            title: "Blocked"
        })
            .expect(200);
        const blockedTask = await request(app).get(`/api/tasks/${taskId}`);
        expect(blockedTask.body.task.status).toBe("errored");
    });
    it("round-trips a session.ended timeline event via /ingest/v1/events", async () => {
        const runtime = await request(app)
            .post("/api/runtime-session-ensure")
            .send({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "runtime-session-end",
            title: "Session End Round Trip"
        });
        expect(runtime.status).toBe(200);
        const taskId = runtime.body.taskId as string;
        const sessionId = runtime.body.sessionId as string;
        const ingest = await request(app)
            .post("/ingest/v1/events")
            .send({
            events: [{
                kind: "session.ended",
                taskId,
                sessionId,
                title: "Session ended (user exit)",
                body: "Claude Code session ended (prompt_input_exit).",
                lane: "user",
                metadata: {
                    reason: "prompt_input_exit",
                    completionReason: "explicit_exit",
                    source: "session-end",
                    durationMs: 1234
                }
            }]
        });
        expect(ingest.status).toBe(200);
        expect(ingest.body.ok).toBe(true);
        expect(ingest.body.data.accepted).toHaveLength(1);
        expect(ingest.body.data.accepted[0].kind).toBe("session.ended");
        expect(ingest.body.data.rejected).toHaveLength(0);
        const taskDetail = await request(app).get(`/api/tasks/${taskId}`);
        expect(taskDetail.status).toBe(200);
        const sessionEndedEvent = taskDetail.body.timeline.find((event: { kind: string }) => event.kind === "session.ended");
        expect(sessionEndedEvent).toBeTruthy();
        expect(sessionEndedEvent.lane).toBe("user");
        expect(sessionEndedEvent.title).toBe("Session ended (user exit)");
        expect(sessionEndedEvent.metadata.reason).toBe("prompt_input_exit");
        expect(sessionEndedEvent.metadata.durationMs).toBe(1234);
        expect(sessionEndedEvent.metadata.source).toBe("session-end");
        expect(sessionEndedEvent.classification.lane).toBe("user");
    });
    it("runtime-session-ensure reuses an explicitly supplied taskId when creating the first binding", async () => {
        await request(app)
            .post("/api/task-start")
            .send({
            taskId: "precreated-task",
            title: "Precreated task"
        });
        const runtime = await request(app)
            .post("/api/runtime-session-ensure")
            .send({
            taskId: "precreated-task",
            runtimeSource: "claude-plugin",
            runtimeSessionId: "runtime-explicit-id",
            title: "Should reuse task"
        });
        expect(runtime.status).toBe(200);
        expect(runtime.body.taskId).toBe("precreated-task");
        const tasks = await request(app).get("/api/tasks");
        const matching = tasks.body.tasks.filter((task: {
            id: string;
        }) => task.id === "precreated-task");
        expect(matching).toHaveLength(1);
    });
});
