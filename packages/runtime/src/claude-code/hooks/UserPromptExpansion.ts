/**
 * Claude Code Hook: UserPromptExpansion
 *
 * Ref: https://code.claude.com/docs/en/hooks#userpromptexpansion
 *
 * Fires when a user-typed slash command (or MCP prompt) expands into a full
 * prompt before Claude processes it. Critical for verification: without this
 * hook the tracer only sees `/foo` and not what `/foo` actually told Claude
 * to do.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "UserPromptExpansion"
 *   expansion_type   "slash_command" | "mcp_prompt"
 *   command_name     string
 *   command_args     string?
 *   command_source   string?
 *   prompt           string
 *
 * Blocking: Yes (decision: "block" cancels expansion). This handler never
 * blocks.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readUserPromptExpansion} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { UserPromptExpansionMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

const SNIPPET_MAX = 2_000;

await runHook("UserPromptExpansion", {
    logger: claudeHookRuntime.logger,
    parse: readUserPromptExpansion,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        if (!payload.commandName) return;

        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const expandedPrompt = payload.prompt ?? "";
        const truncated = expandedPrompt.length > SNIPPET_MAX;
        const snippet = truncated ? `${expandedPrompt.slice(0, SNIPPET_MAX)}…` : expandedPrompt;

        const argsLabel = payload.commandArgs ? ` ${payload.commandArgs}` : "";
        const title = `Slash: /${payload.commandName}${argsLabel}`.slice(0, 200);

        const metadata: UserPromptExpansionMetadata = {
            ...provenEvidence("Observed directly by the UserPromptExpansion hook."),
            expansionType: payload.expansionType || "slash_command",
            commandName: payload.commandName,
            ...(payload.commandArgs ? {commandArgs: payload.commandArgs} : {}),
            ...(payload.commandSource ? {commandSource: payload.commandSource} : {}),
            ...(snippet ? {expandedPromptSnippet: snippet} : {}),
            ...(expandedPrompt ? {expandedPromptBytes: Buffer.byteLength(expandedPrompt, "utf8")} : {}),
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.userPromptExpansion,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.user,
            title,
            ...(snippet ? {body: snippet} : {}),
            metadata,
        });
    },
});
