/**
 * @module tools/conversation
 *
 * Conversation and session lifecycle tool registrations.
 * Records canonical user/assistant messages and session lifecycle events.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";

/**
 * Register conversation tools.
 * Includes: monitor_user_message, monitor_assistant_response, monitor_session_end
 */
export function registerConversationTools(server: McpServer, client: MonitorClient): void {
  server.registerTool(
    "monitor_user_message",
    {
      title: "Monitor User Message",
      description:
        "Record a canonical user.message event (contractVersion 1). " +
        "Use captureMode='raw' for actual user prompt text. " +
        "Use captureMode='derived' for inferred/enriched records — sourceEventId is required. " +
        "All callers must provide sessionId. " +
        "If raw prompt text is unavailable, use monitor_rule with ruleId='user-message-capture-unavailable' instead.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string(),
        messageId: z.string(),
        captureMode: z.enum(["raw", "derived"]),
        source: z.string(),
        phase: z.enum(["initial", "follow_up"]).optional(),
        title: z.string(),
        body: z.string().optional(),
        sourceEventId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        contractVersion: z.string().optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/user-message", input))
  );

  server.registerTool(
    "monitor_assistant_response",
    {
      title: "Monitor Assistant Response",
      description:
        "Record the assistant's user-facing response as a canonical assistant.response event. " +
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
    },
    async (input) => toToolResponse(await client.post("/api/assistant-response", input))
  );

  server.registerTool(
    "monitor_session_end",
    {
      title: "Monitor Session End",
      description:
        "End the current runtime session without completing the work item. " +
        "The task remains running; the work item accumulates messages across multiple sessions. " +
        "Use monitor_task_complete to explicitly close the work item when all work is done. " +
        "Claude hooks should keep completeTask unset; OpenCode primary session shutdown may choose explicit completion through its adapter policy.",
      inputSchema: {
        taskId: z.string(),
        sessionId: z.string().optional(),
        summary: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => toToolResponse(await client.post("/api/session-end", input))
  );
}
