import path from "node:path";
import { ActionName, MessageId, RuleId, TodoId, ToolName, WorkspacePath, type EventId, type SessionId as MonitorSessionId } from "@monitor/core";
import { MonitorService } from "@monitor/application";
import { createSqliteMonitorPorts } from "@monitor/adapter-sqlite";
const databasePath = path.resolve(process.cwd(), ".monitor", "monitor.sqlite");
const workspacePath = WorkspacePath(process.cwd());
const ports = createSqliteMonitorPorts({ databasePath });
const service = new MonitorService(ports);
await seedDashboardTask();
await seedCoordinationTask();
console.log("Seeded Monitor demo data.");
async function seedDashboardTask(): Promise<void> {
    const started = await service.startTask({
        title: "Build Monitor parity dashboard",
        workspacePath,
        summary: "Seeded task for local Monitor demo."
    });
    const sessionId = requireSessionId(started, started.task.title);
    await service.logToolUsed({
        taskId: started.task.id,
        sessionId,
        toolName: ToolName("write_file"),
        title: "Implement dashboard shell",
        body: "Built counters, timeline lanes, and inspector drawer.",
        filePaths: [
            "packages/web/src/App.tsx",
            "packages/web/src/styles.css"
        ]
    });
    await service.logPlan({
        taskId: started.task.id,
        sessionId,
        action: ActionName("plan_rule_guard_overlay"),
        body: "Decided to visualize checks, violations, passes, and explored files."
    });
    await service.logAction({
        taskId: started.task.id,
        sessionId,
        action: ActionName("read_auth_logic"),
        body: "Inspected auth flows before wiring new guard events.",
        filePaths: ["packages/server/src/application/monitor-service.ts", "packages/mcp/src/index.ts"]
    });
    await service.logVerification({
        taskId: started.task.id,
        sessionId,
        action: ActionName("run_test_dashboard_rules"),
        result: "PASS 12/12",
        filePaths: ["packages/server/test/application/monitor-service.test.ts", "packages/web/src/App.tsx"]
    });
    await service.logRule({
        taskId: started.task.id,
        sessionId,
        action: ActionName("check_rule_guard"),
        ruleId: RuleId("c5-compliance"),
        severity: "high",
        status: "violation",
        body: "Rule Guard flagged a missing verification step."
    });
    await service.logTerminalCommand({
        taskId: started.task.id,
        sessionId,
        command: "npm run test",
        filePaths: [
            "packages/server/test/application/monitor-service.test.ts",
            "packages/web/src/lib/timeline.test.ts"
        ]
    });
    await service.saveContext({
        taskId: started.task.id,
        sessionId,
        title: "Context snapshot",
        body: "Backend, MCP, and dashboard milestones are wired together.",
        filePaths: ["docs/tasks/005-dashboard.md"]
    });
    await service.completeTask({
        taskId: started.task.id,
        sessionId,
        summary: "Seed data finished."
    });
}
async function seedCoordinationTask(): Promise<void> {
    const started = await service.startTask({
        title: "Trace coordination support flow",
        workspacePath,
        summary: "Seeded task that demonstrates how coordination activities explain a todo journey."
    });
    const sessionId = requireSessionId(started, started.task.title);
    const taskId = started.task.id;
    const userRequestId = firstEventId(await service.logUserMessage({
        taskId, sessionId, messageId: MessageId("seed-coordination-flow-1"), captureMode: "raw",
        source: "seed-script", phase: "initial", title: "Show a coordination-lane example",
        body: "Need one todo-centric timeline that shows skill use, MCP calls, delegation, handoff, action, verify, search, and bookmark."
    }), "coordination user message");
    const todoAddedId = firstEventId(await service.logTodo({
        taskId, sessionId, todoId: TodoId("todo:card-connection"), todoState: "added", sequence: 1,
        title: "Add seeded coordination flow",
        body: "Create one todo that can be traced from the user request to a follow-up bookmark.",
        parentEventId: userRequestId, relationType: "caused_by",
        relationLabel: "request created todo",
        relationExplanation: "The user request directly created the todo for the coordination demo."
    }), "coordination todo added");
    const skillUseId = firstEventId(await service.logAgentActivity({
        taskId, sessionId, activityType: "skill_use", title: "Loaded monitoring workflow",
        skillName: "monitor-workflow", skillPath: ".claude/plugin",
        parentEventId: todoAddedId, relationType: "implements",
        relationLabel: "monitoring workflow loaded",
        relationExplanation: "The monitoring workflow is loaded before the todo is carried out."
    }), "coordination skill use");
    const mcpCallId = firstEventId(await service.logAgentActivity({
        taskId, sessionId, activityType: "mcp_call", title: "Called monitor_explore on monitor-server",
        mcpServer: "monitor-server", mcpTool: "monitor_explore",
        parentEventId: skillUseId, relationType: "implements",
        relationLabel: "repo inspection started",
        relationExplanation: "The MCP exploration call gathers the context needed to shape the seeded example.",
        filePaths: ["packages/server/src/seed.ts", "packages/web/src/components/EventInspector.tsx"]
    }), "coordination MCP call");
    const delegationId = firstEventId(await service.logAgentActivity({
        taskId, sessionId, activityType: "delegation", title: "Delegated server package review to Leibniz",
        agentName: "Leibniz", parentEventId: todoAddedId,
        relationType: "delegates", relationLabel: "server review delegated",
        relationExplanation: "A focused server review is delegated in parallel to map the flow more quickly.",
        filePaths: ["packages/server/src/presentation/schemas.ts", "packages/server/src/application/monitor-service.ts"]
    }), "coordination delegation");
    const planEventId = firstEventId(await service.logPlan({
        taskId, sessionId, action: ActionName("plan_seed_coordination_journey"), title: "Plan coordination seed journey",
        body: "Map one todo through skill use, MCP exploration, delegation, implementation, verification, search, and bookmark.",
        parentEventId: mcpCallId, relationType: "implements",
        relationLabel: "seed plan drafted",
        relationExplanation: "The plan turns exploration results into a concrete seed journey."
    }), "coordination plan");
    const handoffEventId = firstEventId(await service.logAgentActivity({
        taskId, sessionId, activityType: "handoff", title: "Received findings from Leibniz",
        agentName: "Leibniz", relatedEventIds: [delegationId],
        relationType: "returns", relationLabel: "delegation returned",
        relationExplanation: "The delegated review returns findings that feed back into the main implementation plan.",
        body: "Server metadata already carries relation fields, so the seed can focus on event wiring."
    }), "coordination handoff");
    const actionId = firstEventId(await service.logAction({
        taskId, sessionId, action: ActionName("seed_coordination_example"), title: "Seed coordination flow example",
        body: "Added a todo-centric scenario so the timeline shows coordination cards, explicit connectors, and follow-up evidence.",
        parentEventId: planEventId, relatedEventIds: [handoffEventId],
        relationType: "implements", relationLabel: "seed written",
        relationExplanation: "The implementation applies both the plan and the returned handoff findings.",
        filePaths: ["packages/server/src/seed.ts"]
    }), "coordination action");
    const verifyId = firstEventId(await service.logVerification({
        taskId, sessionId, action: ActionName("run_seed_for_coordination_demo"), title: "Verify seeded coordination flow",
        body: "Confirmed the seeded task exposes coordination chips, connector explanations, and a bookmarkable follow-up event.",
        result: "PASS coordination flow visible", parentEventId: actionId,
        relationType: "verifies", relationLabel: "seed verified",
        relationExplanation: "Verification checks that the example produces the intended coordination narrative in the UI.",
        filePaths: ["packages/server/src/seed.ts", "packages/web/src/components/Timeline.tsx", "packages/web/src/components/EventInspector.tsx"]
    }), "coordination verification");
    const searchId = firstEventId(await service.logAgentActivity({
        taskId, sessionId, activityType: "search", title: "Searched saved cards for relationType",
        parentEventId: verifyId, relationType: "relates_to",
        relationLabel: "follow-up search",
        relationExplanation: "After verification, saved cards are searched to confirm the relation metadata stays discoverable."
    }), "coordination search");
    const bookmarkEventId = firstEventId(await service.logAgentActivity({
        taskId, sessionId, activityType: "bookmark", title: "Saved task for follow-up",
        parentEventId: searchId, relationType: "completes",
        relationLabel: "follow-up saved",
        relationExplanation: "The verified example is bookmarked so the team can return to this flow during future UI reviews."
    }), "coordination bookmark");
    await service.saveBookmark({
        taskId, eventId: bookmarkEventId, title: "Saved task for follow-up",
        note: "Use this bookmark to demo how a coordination event can become a saved follow-up."
    });
    firstEventId(await service.logTodo({
        taskId, sessionId, todoId: TodoId("todo:card-connection"), todoState: "completed", sequence: 2,
        title: "Seeded coordination flow ready",
        body: "The demo now shows one todo that can be traced from the user request to a saved follow-up.",
        parentEventId: bookmarkEventId, relationType: "completes",
        relationLabel: "todo completed",
        relationExplanation: "The todo is completed only after the example is verified and bookmarked."
    }), "coordination todo completed");
    await service.completeTask({ taskId, sessionId, summary: "Seeded coordination flow finished." });
}
function requireSessionId(started: {
    readonly sessionId?: MonitorSessionId;
    readonly task: {
        readonly title: string;
    };
}, title: string): MonitorSessionId {
    if (!started.sessionId)
        throw new Error(`Seed session missing for ${title}.`);
    return started.sessionId;
}
function firstEventId(envelope: {
    readonly events: readonly {
        readonly id: EventId;
    }[];
}, label: string): EventId {
    const [event] = envelope.events;
    if (!event)
        throw new Error(`Seed event missing for ${label}.`);
    return event.id;
}
