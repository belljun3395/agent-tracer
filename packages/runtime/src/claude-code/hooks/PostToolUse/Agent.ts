/**
 * Claude Code Hook: PostToolUse — matcher: "Agent"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Agent tool_input fields:
 *   prompt            string  — task description for the spawned agent
 *   description       string?
 *   subagent_type     string?
 *   run_in_background boolean?
 *   model             string?
 *
 * For background agents, the child runtime session is linked to the parent
 * via parentTaskId/parentSessionId so the monitor creates the child as a
 * background task on first ensure.
 */
import {runPostToolUseHook} from "./_shared.js";
import {postAgentEvent} from "./_agent.ops.js";

await runPostToolUseHook("Agent", postAgentEvent);
