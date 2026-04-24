/**
 * Claude Code Hook: PostToolUse — matcher: "TaskUpdate"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * TaskUpdate tool_input fields:
 *   task_id  string
 *   status   string — e.g. "in_progress", "completed"
 */
import {runPostToolUseHook} from "./_shared.js";
import {postTodoEvents} from "./_todo.ops.js";

await runPostToolUseHook("TaskUpdate", postTodoEvents);
