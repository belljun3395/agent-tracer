import path from "node:path";
import { normalizeWorkspacePath } from "~domain/index.js";
import { SaveBookmarkUseCase } from "~application/bookmarks/index.js";
import { LogEventUseCase } from "~application/events/index.js";
import {
    createSqliteDatabaseContext,
    SqliteBookmarkRepository,
    SqliteEventRepository,
    SqliteSessionRepository,
    SqliteTaskRepository,
} from "~adapters/persistence/sqlite/index.js";
import { StartTaskUseCase, CompleteTaskUseCase } from "~application/tasks/index.js";
import type { INotificationPublisher } from "~application/index.js";

const databasePath = path.resolve(process.cwd(), ".monitor", "monitor.sqlite");
const workspacePath = normalizeWorkspacePath(process.cwd());
const databaseContext = createSqliteDatabaseContext(databasePath);
const notifier: INotificationPublisher = { publish: () => { } };
const tasks = new SqliteTaskRepository(databaseContext.db);
const sessions = new SqliteSessionRepository(databaseContext.db);
const events = new SqliteEventRepository(databaseContext.db);
const bookmarks = new SqliteBookmarkRepository(databaseContext.db);
const logEvent = new LogEventUseCase(tasks, events, notifier);
const startTask = new StartTaskUseCase(tasks, sessions, events, notifier);
const completeTask = new CompleteTaskUseCase(tasks, sessions, events, notifier);
const saveBookmark = new SaveBookmarkUseCase(tasks, events, bookmarks, notifier);

try {
    await seedDashboardTask();
    await seedCoordinationTask();
    console.log("Seeded Monitor demo data.");
} finally {
    databaseContext.close();
}

async function seedDashboardTask(): Promise<void> {
    const started = await startTask.execute({
        title: "Build Monitor parity dashboard",
        workspacePath,
        summary: "Seeded task for local Monitor demo."
    });
    const sessionId = requireSessionId(started, started.task.title);
    const taskId = started.task.id;

    await logEvent.execute({
        taskId, sessionId, kind: "tool.used", lane: "implementation",
        title: "Implement dashboard shell",
        body: "Built counters, timeline lanes, and inspector drawer.",
        filePaths: [
            "packages/web-app/src/App.tsx",
            "packages/web-app/src/styles.css"
        ],
        metadata: { toolName: "write_file" }
    });
    await logEvent.execute({
        taskId, sessionId, kind: "plan.logged", lane: "planning",
        body: "Decided to visualize checks, violations, passes, and explored files.",
        metadata: { actionName: "plan_rule_guard_overlay" }
    });
    await logEvent.execute({
        taskId, sessionId, kind: "action.logged", lane: "implementation",
        body: "Inspected auth flows before wiring new guard events.",
        filePaths: ["packages/server/src/application/monitor-service.ts", "packages/adapter-mcp/src/index.ts"],
        metadata: { actionName: "read_auth_logic" }
    });
    await logEvent.execute({
        taskId, sessionId, kind: "verification.logged", lane: "implementation",
        filePaths: ["packages/server/test/application/monitor-service.test.ts", "packages/web-app/src/App.tsx"],
        metadata: { actionName: "run_test_dashboard_rules", verificationStatus: "PASS 12/12" }
    });
    await logEvent.execute({
        taskId, sessionId, kind: "rule.logged", lane: "implementation",
        body: "Rule Guard flagged a missing verification step.",
        metadata: { actionName: "check_rule_guard", ruleId: "c5-compliance", severity: "high", ruleStatus: "violation" }
    });
    await logEvent.execute({
        taskId, sessionId, kind: "terminal.command", lane: "implementation",
        title: "npm run test",
        body: "npm run test",
        filePaths: [
            "packages/server/test/application/monitor-service.test.ts",
            "packages/web-app/src/lib/timeline.test.ts"
        ],
        metadata: { command: "npm run test" }
    });
    await logEvent.execute({
        taskId, sessionId, kind: "context.saved", lane: "planning",
        title: "Context snapshot",
        body: "Backend, MCP, and dashboard milestones are wired together.",
        filePaths: ["docs/tasks/005-dashboard.md"]
    });
    await completeTask.execute({ taskId, sessionId, summary: "Seed data finished." });
}

async function seedCoordinationTask(): Promise<void> {
    const started = await startTask.execute({
        title: "Trace coordination support flow",
        workspacePath,
        summary: "Seeded task that demonstrates how coordination activities explain a todo journey."
    });
    const sessionId = requireSessionId(started, started.task.title);
    const taskId = started.task.id;

    const userRequestId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "user.message", lane: "user",
        title: "Show a coordination-lane example",
        body: "Need one todo-centric timeline that shows skill use, MCP calls, delegation, handoff, action, verify, search, and bookmark.",
        metadata: { messageId: "seed-coordination-flow-1", captureMode: "raw", source: "seed-script", phase: "initial" }
    }), "coordination user message");

    const todoAddedId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "todo.logged", lane: "todos",
        title: "Add seeded coordination flow",
        body: "Create one todo that can be traced from the user request to a follow-up bookmark.",
        parentEventId: userRequestId, relationType: "caused_by",
        relationLabel: "request created todo",
        relationExplanation: "The user request directly created the todo for the coordination demo.",
        metadata: { todoId: "todo:card-connection", todoState: "added", sequence: 1 }
    }), "coordination todo added");

    const skillUseId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "agent.activity.logged", lane: "coordination",
        title: "Loaded monitoring workflow",
        parentEventId: todoAddedId, relationType: "implements",
        relationLabel: "monitoring workflow loaded",
        relationExplanation: "The monitoring workflow is loaded before the todo is carried out.",
        metadata: { activityType: "skill_use", skillName: "monitor-workflow", skillPath: "packages/runtime" }
    }), "coordination skill use");

    const mcpCallId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "agent.activity.logged", lane: "coordination",
        title: "Called monitor_explore on monitor-server",
        parentEventId: skillUseId, relationType: "implements",
        relationLabel: "repo inspection started",
        relationExplanation: "The MCP exploration call gathers the context needed to shape the seeded example.",
        filePaths: ["packages/server/src/seed.ts", "packages/web-app/src/components/EventInspector.tsx"],
        metadata: { activityType: "mcp_call", mcpServer: "monitor-server", mcpTool: "monitor_explore" }
    }), "coordination MCP call");

    const delegationId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "agent.activity.logged", lane: "coordination",
        title: "Delegated server package review to Leibniz",
        parentEventId: todoAddedId, relationType: "delegates",
        relationLabel: "server review delegated",
        relationExplanation: "A focused server review is delegated in parallel to map the flow more quickly.",
        filePaths: ["packages/server/src/presentation/schemas.ts", "packages/server/src/application/monitor-service.ts"],
        metadata: { activityType: "delegation", agentName: "Leibniz" }
    }), "coordination delegation");

    const planEventId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "plan.logged", lane: "planning",
        title: "Plan coordination seed journey",
        body: "Map one todo through skill use, MCP exploration, delegation, implementation, verification, search, and bookmark.",
        parentEventId: mcpCallId, relationType: "implements",
        relationLabel: "seed plan drafted",
        relationExplanation: "The plan turns exploration results into a concrete seed journey.",
        metadata: { actionName: "plan_seed_coordination_journey" }
    }), "coordination plan");

    const handoffEventId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "agent.activity.logged", lane: "coordination",
        title: "Received findings from Leibniz",
        relatedEventIds: [delegationId], relationType: "returns",
        relationLabel: "delegation returned",
        relationExplanation: "The delegated review returns findings that feed back into the main implementation plan.",
        body: "Server metadata already carries relation fields, so the seed can focus on event wiring.",
        metadata: { activityType: "handoff", agentName: "Leibniz" }
    }), "coordination handoff");

    const actionId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "action.logged", lane: "implementation",
        title: "Seed coordination flow example",
        body: "Added a todo-centric scenario so the timeline shows coordination cards, explicit connectors, and follow-up evidence.",
        parentEventId: planEventId, relatedEventIds: [handoffEventId],
        relationType: "implements", relationLabel: "seed written",
        relationExplanation: "The implementation applies both the plan and the returned handoff findings.",
        filePaths: ["packages/server/src/seed.ts"],
        metadata: { actionName: "seed_coordination_example" }
    }), "coordination action");

    const verifyId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "verification.logged", lane: "implementation",
        title: "Verify seeded coordination flow",
        body: "Confirmed the seeded task exposes coordination chips, connector explanations, and a bookmarkable follow-up event.",
        parentEventId: actionId, relationType: "verifies",
        relationLabel: "seed verified",
        relationExplanation: "Verification checks that the example produces the intended coordination narrative in the UI.",
        filePaths: ["packages/server/src/seed.ts", "packages/web-app/src/components/Timeline.tsx", "packages/web-app/src/components/EventInspector.tsx"],
        metadata: { actionName: "run_seed_for_coordination_demo", verificationStatus: "PASS coordination flow visible" }
    }), "coordination verification");

    const searchId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "agent.activity.logged", lane: "coordination",
        title: "Searched saved cards for relationType",
        parentEventId: verifyId, relationType: "relates_to",
        relationLabel: "follow-up search",
        relationExplanation: "After verification, saved cards are searched to confirm the relation metadata stays discoverable.",
        metadata: { activityType: "search" }
    }), "coordination search");

    const bookmarkEventId = firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "agent.activity.logged", lane: "coordination",
        title: "Saved task for follow-up",
        parentEventId: searchId, relationType: "completes",
        relationLabel: "follow-up saved",
        relationExplanation: "The verified example is bookmarked so the team can return to this flow during future UI reviews.",
        metadata: { activityType: "bookmark" }
    }), "coordination bookmark");

    await saveBookmark.execute({
        taskId, eventId: bookmarkEventId, title: "Saved task for follow-up",
        note: "Use this bookmark to demo how a coordination event can become a saved follow-up."
    });

    firstEventId(await logEvent.execute({
        taskId, sessionId, kind: "todo.logged", lane: "todos",
        title: "Seeded coordination flow ready",
        body: "The demo now shows one todo that can be traced from the user request to a saved follow-up.",
        parentEventId: bookmarkEventId, relationType: "completes",
        relationLabel: "todo completed",
        relationExplanation: "The todo is completed only after the example is verified and bookmarked.",
        metadata: { todoId: "todo:card-connection", todoState: "completed", sequence: 2 }
    }), "coordination todo completed");

    await completeTask.execute({ taskId, sessionId, summary: "Seeded coordination flow finished." });
}

function requireSessionId(started: {
    readonly sessionId?: string;
    readonly task: { readonly title: string };
}, title: string): string {
    if (!started.sessionId) throw new Error(`Seed session missing for ${title}.`);
    return started.sessionId;
}

function firstEventId(envelope: {
    readonly events: readonly { readonly id: string }[];
}, label: string): string {
    const [event] = envelope.events;
    if (!event) throw new Error(`Seed event missing for ${label}.`);
    return event.id;
}
