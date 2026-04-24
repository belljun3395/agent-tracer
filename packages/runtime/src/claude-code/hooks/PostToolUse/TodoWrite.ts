/**
 * Claude Code Hook: PostToolUse — matcher: "TodoWrite"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * TodoWrite tool_input fields:
 *   todos: [{ content: string, status: string, priority: string }]
 *
 * Reconciles the new list against the previously stored snapshot to emit
 * explicit "cancelled" transitions for items removed from the list.
 */
import {runPostToolUseHook} from "./_shared.js";
import {postTodoEvents} from "./_todo.ops.js";

await runPostToolUseHook("TodoWrite", postTodoEvents);
