/**
 * Claude Code Hook: PostToolUse — matcher: "Edit"
 *
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Fires after an Edit tool call succeeds. Does not fire on failures
 * (see PostToolUseFailure.ts).
 *
 * Edit tool_input fields:
 *   file_path  string — absolute path of the file being edited
 */
import {runPostToolUseHook} from "./_shared.js";
import {postFileToolEvent} from "./_file.ops.js";

await runPostToolUseHook("Edit", postFileToolEvent);
