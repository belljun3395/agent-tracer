/**
 * Claude Code Hook: PostToolUse — matcher: "Skill"
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Skill tool_input fields:
 *   skill  string  — skill name to invoke
 *   args   string? — optional arguments passed to the skill
 */
import {runPostToolUseHook} from "./_shared.js";
import {postSkillEvent} from "./_skill.ops.js";

await runPostToolUseHook("Skill", postSkillEvent);
