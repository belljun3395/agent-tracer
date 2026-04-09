import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";
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
    }, async (input) => toToolResponse(await client.post("/api/tool-used", input)));
    server.registerTool("monitor_terminal_command", {
        title: "Monitor Terminal Command",
        description: "Record a terminal command executed during a task. Use lane='implementation' for commands.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            command: z.string(),
            title: z.string().optional(),
            body: z.string().optional(),
            lane: z.enum(["implementation"]).optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/terminal-command", input)));
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
            lane: z.enum(["user", "exploration", "planning", "implementation"]).optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/save-context", input)));
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
    }, async (input) => toToolResponse(await client.post("/api/plan", input)));
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
    }, async (input) => toToolResponse(await client.post("/api/action", input)));
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
    }, async (input) => toToolResponse(await client.post("/api/verify", input)));
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
    }, async (input) => toToolResponse(await client.post("/api/rule", input)));
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
    }, async (input) => toToolResponse(await client.post("/api/explore", input)));
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
            questionPhase: z.enum(["asked", "answered", "concluded"]),
            sequence: z.number().int().nonnegative().optional(),
            title: z.string(),
            body: z.string().optional(),
            modelName: z.string().optional(),
            modelProvider: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/question", input)));
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
            todoState: z.enum(["added", "in_progress", "completed", "cancelled"]),
            sequence: z.number().int().nonnegative().optional(),
            title: z.string(),
            body: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/todo", input)));
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
    }, async (input) => toToolResponse(await client.post("/api/thought", input)));
    server.registerTool("monitor_agent_activity", {
        title: "Monitor Agent Activity",
        description: "Record coordination-lane activity such as MCP calls, skill usage, delegation, handoff, search, and bookmarks. " +
            "Use this when you want the dashboard to explain how agent support actions shaped the work.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            activityType: z.enum(["agent_step", "mcp_call", "skill_use", "delegation", "handoff", "bookmark", "search"]),
            title: z.string().optional(),
            body: z.string().optional(),
            agentName: z.string().optional(),
            skillName: z.string().optional(),
            skillPath: z.string().optional(),
            mcpServer: z.string().optional(),
            mcpTool: z.string().optional(),
            parentEventId: z.string().optional(),
            relatedEventIds: z.array(z.string()).optional(),
            relationType: z.enum([
                "implements",
                "revises",
                "verifies",
                "answers",
                "delegates",
                "returns",
                "completes",
                "blocks",
                "caused_by",
                "relates_to"
            ]).optional(),
            relationLabel: z.string().optional(),
            relationExplanation: z.string().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/agent-activity", input)));
}
