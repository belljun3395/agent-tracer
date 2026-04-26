import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    AGENT_ACTIVITY_TYPES,
    EVENT_RELATION_TYPES,
    QUESTION_PHASES,
    TODO_STATES,
    type TimelineLane,
} from "~domain/index.js";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";

const IMPLEMENTATION_ONLY_LANES = ["implementation"] as const satisfies readonly TimelineLane[];
const SAVE_CONTEXT_LANES = ["user", "exploration", "planning", "implementation"] as const satisfies readonly TimelineLane[];

export function registerEventLoggingTools(server: McpServer, client: MonitorClient): void {
    server.registerTool("monitor_tool_used", {
        title: "Monitor Tool Used",
        description: "Record tool usage during a task.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            toolName: z.string(),
            title: z.string().optional(),
            body: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "tool.used", lane: "implementation", ...input }] })));
    server.registerTool("monitor_terminal_command", {
        title: "Monitor Terminal Command",
        description: "Record a terminal command executed during a task. Use lane='implementation' for commands.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            command: z.string(),
            title: z.string().optional(),
            body: z.string().optional(),
            lane: z.enum(IMPLEMENTATION_ONLY_LANES).optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "terminal.command", ...input, lane: input.lane ?? "implementation" }] })));
    server.registerTool("monitor_save_context", {
        title: "Monitor Save Context",
        description: "Record a planning thought, analysis, or context snapshot. " +
            "Use lane='planning' for thoughts/plans, 'exploration' for discovery, " +
            "'implementation' for execution notes, and 'user' for user-facing messages.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            title: z.string(),
            body: z.string().optional(),
            lane: z.enum(SAVE_CONTEXT_LANES).optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "context.saved", ...input, lane: input.lane ?? "planning" }] })));
    server.registerTool("monitor_plan", {
        title: "Monitor Plan",
        description: "Record a planning step or approach decision using a free-form snake_case action name.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            action: z.string(),
            title: z.string().optional(),
            body: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "plan.logged", lane: "planning", ...input }] })));
    server.registerTool("monitor_action", {
        title: "Monitor Action",
        description: "Record an agent action before execution using a free-form snake_case action name.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            action: z.string(),
            title: z.string().optional(),
            body: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "action.logged", lane: "implementation", ...input }] })));
    server.registerTool("monitor_verify", {
        title: "Monitor Verify",
        description: "Record a verification step such as tests, build, or lint with a structured result.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            action: z.string(),
            result: z.string(),
            status: z.string().optional(),
            title: z.string().optional(),
            body: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "verification.logged", lane: "implementation", ...input }] })));
    server.registerTool("monitor_rule", {
        title: "Monitor Rule",
        description: "Record a rule-related event such as a check, violation, or fix with rule metadata.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            action: z.string(),
            ruleId: z.string(),
            severity: z.string(),
            status: z.string(),
            source: z.string().optional(),
            title: z.string().optional(),
            body: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "rule.logged", lane: "implementation", ...input }] })));
    server.registerTool("monitor_explore", {
        title: "Monitor Explore",
        description: "Record an exploration action: file read, code search, dependency check, or documentation lookup.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            toolName: z.string(),
            title: z.string(),
            body: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "tool.used", lane: "exploration", ...input }] })));
    server.registerTool("monitor_question", {
        title: "Monitor Question",
        description: "Record a question flow event. " +
            "Use phase='asked' when the agent poses a question to the user, " +
            "'answered' when a user answer is received, " +
            "'concluded' when the agent draws a conclusion (routes to planning lane). " +
            "Use the same questionId for all phases of one question.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            questionId: z.string(),
            questionPhase: z.enum(QUESTION_PHASES),
            sequence: z.number().int().nonnegative().optional(),
            title: z.string(),
            body: z.string().optional(),
            modelName: z.string().optional(),
            modelProvider: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", {
        events: [{
            kind: "question.logged",
            lane: input.questionPhase === "concluded" ? "planning" : "questions",
            ...input
        }]
    })));
    server.registerTool("monitor_todo", {
        title: "Monitor Todo",
        description: "Record a todo item lifecycle transition. " +
            "Use state='added' when first created, 'in_progress' when started, " +
            "'completed' or 'cancelled' when finished. " +
            "Use the same todoId for all transitions of one todo item.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            todoId: z.string(),
            todoState: z.enum(TODO_STATES),
            sequence: z.number().int().nonnegative().optional(),
            title: z.string(),
            body: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "todo.logged", lane: "todos", ...input }] })));
    server.registerTool("monitor_thought", {
        title: "Monitor Thought",
        description: "Record a summarized reasoning step in the planning lane. " +
            "Use for summary-safe thoughts only — do NOT dump raw chain-of-thought. " +
            "Include modelName/modelProvider when model identity is known.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            title: z.string(),
            body: z.string().optional(),
            modelName: z.string().optional(),
            modelProvider: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "thought.logged", lane: "planning", ...input }] })));
    server.registerTool("monitor_agent_activity", {
        title: "Monitor Agent Activity",
        description: "Record coordination-lane activity such as MCP calls, skill usage, delegation, handoff, and search. " +
            "Use this when you want the dashboard to explain how agent support actions shaped the work.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            activityType: z.enum(AGENT_ACTIVITY_TYPES),
            title: z.string().optional(),
            body: z.string().optional(),
            agentName: z.string().optional(),
            skillName: z.string().optional(),
            skillPath: z.string().optional(),
            mcpServer: z.string().optional(),
            mcpTool: z.string().optional(),
            parentEventId: z.string().optional(),
            relatedEventIds: z.array(z.string()).optional(),
            relationType: z.enum(EVENT_RELATION_TYPES).optional(),
            relationLabel: z.string().optional(),
            relationExplanation: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "agent.activity.logged", lane: "coordination", ...input }] })));
}
