/**
 * Claude Code Hook: PostToolUse — matcher: "WebFetch"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * WebFetch tool_input fields: { url: string, prompt?: string }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("WebFetch", postExploreToolEvent);
