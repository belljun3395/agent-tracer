/**
 * Claude Code Hook: PostToolUse — matcher: "Read"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Read tool_input fields: { file_path: string }
 */
import {runPostToolUseHook} from "./_shared.js";
import {postExploreToolEvent} from "./_explore.ops.js";

await runPostToolUseHook("Read", postExploreToolEvent);
