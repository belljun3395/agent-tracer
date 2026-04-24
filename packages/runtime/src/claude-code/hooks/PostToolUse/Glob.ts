/**
 * Claude Code Hook: PostToolUse — matcher: "Glob"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Glob tool_input fields: { pattern: string, path?: string }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("Glob", postExploreToolEvent);
