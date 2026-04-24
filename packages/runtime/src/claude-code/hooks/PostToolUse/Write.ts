/**
 * Claude Code Hook: PostToolUse — matcher: "Write"
 *
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Fires after a Write tool call succeeds. Does not fire on failures
 * (see PostToolUseFailure.ts).
 *
 * Write tool_input fields:
 *   file_path  string — absolute path of the file being written
 */
import {runPostToolUseHook} from "./_shared.js";
import {postFileToolEvent} from "./_file.ops.js";

await runPostToolUseHook("Write", postFileToolEvent);
