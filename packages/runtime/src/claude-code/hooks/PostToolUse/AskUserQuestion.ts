/**
 * Claude Code Hook: PostToolUse — matcher: "AskUserQuestion"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * AskUserQuestion tool_input fields: { question: string, options?: string[] }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("AskUserQuestion", postExploreToolEvent);
