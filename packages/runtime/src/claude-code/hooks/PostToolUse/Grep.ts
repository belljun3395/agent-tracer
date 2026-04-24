/**
 * Claude Code Hook: PostToolUse — matcher: "Grep"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Grep tool_input fields: { pattern: string, path?: string, glob?: string }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("Grep", postExploreToolEvent);
