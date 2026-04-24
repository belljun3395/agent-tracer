/**
 * Claude Code Hook: PostToolUse — matcher: "ExitPlanMode"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * ExitPlanMode tool_input fields: { plan: string }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("ExitPlanMode", postExploreToolEvent);
