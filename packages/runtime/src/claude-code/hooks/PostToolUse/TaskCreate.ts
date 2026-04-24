/**
 * Claude Code Hook: PostToolUse — matcher: "TaskCreate"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * TaskCreate tool_input fields:
 *   task_subject     string
 *   task_description string?
 */
import {runPostToolUseHook} from "./_shared.js";
import {postTodoEvents} from "./_todo.ops.js";

await runPostToolUseHook("TaskCreate", postTodoEvents);
