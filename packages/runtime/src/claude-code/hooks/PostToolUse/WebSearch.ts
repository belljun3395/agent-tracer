/**
 * Claude Code Hook: PostToolUse — matcher: "WebSearch"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * WebSearch tool_input fields: { query: string }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("WebSearch", postExploreToolEvent);
