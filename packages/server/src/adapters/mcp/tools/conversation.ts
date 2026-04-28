import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { USER_MESSAGE_CAPTURE_MODES, USER_MESSAGE_PHASES } from "~event/domain/common/const/event.meta.const.js";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";
export function registerConversationTools(server: McpServer, client: MonitorClient): void {
    server.registerTool("monitor_user_message", {
        title: "Monitor User Message",
        description: "Record a canonical user.message event (contractVersion 1). " +
            "Use captureMode='raw' for actual user prompt text. " +
            "Use captureMode='derived' for inferred/enriched records — sourceEventId is required. " +
            "All callers must provide sessionId and phase ('initial' for the first user message in the task, 'follow_up' otherwise). " +
            "If raw prompt text is unavailable, use monitor_rule with ruleId='user-message-capture-unavailable' instead.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string(),
            messageId: z.string(),
            captureMode: z.enum(USER_MESSAGE_CAPTURE_MODES),
            source: z.string(),
            phase: z.enum(USER_MESSAGE_PHASES),
            title: z.string(),
            body: z.string().optional(),
            sourceEventId: z.string().optional(),
            metadata: z.record(z.unknown()).optional(),
            contractVersion: z.string().optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "user.message", lane: "user", ...input }] })));
    server.registerTool("monitor_assistant_response", {
        title: "Monitor Assistant Response",
        description: "Record the assistant's user-facing response as a canonical assistant.response event. " +
            "Call this immediately before sending the final answer when the runtime has no native response hook.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            messageId: z.string(),
            source: z.string(),
            title: z.string(),
            body: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "assistant.response", lane: "user", ...input }] })));
}
