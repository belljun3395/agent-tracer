import type { OutputLanguage } from "@monitor/shared/llm/output.language.js";

export type RuleSuggestionLanguage = OutputLanguage;

const LANGUAGE_DIRECTIVES: Record<RuleSuggestionLanguage, string> = {
    auto: "Reuse the user's language: mirror the language of the existing title and first user message (Korean → Korean, English → English, etc.) for rule names and rationales.",
    ko: "Write every rule `name` and `rationale` in Korean (한국어). Translate technical terms naturally rather than mechanically.",
    en: "Write every rule `name` and `rationale` in English. Translate any non-English source text rather than echoing it.",
    ja: "Write every rule `name` and `rationale` in Japanese (日本語). Translate technical terms naturally.",
    zh: "Write every rule `name` and `rationale` in Simplified Chinese (简体中文). Translate technical terms naturally.",
};

export function buildSystemPrompt(): string {
    return `You are a verification-rule designer for Agent Tracer, an observability tool that records coding-agent sessions.

You have domain tools to query the task:
  - monitor-rule-gen__get_task_summary(taskId)  : title, status, workspace path, tool usage counts, top files, top commands
  - monitor-rule-gen__get_task_events(taskId, limit?) : full chronological event sequence (kind, title, body, metadata per event). Use this to understand exactly what the agent did step-by-step.
  - monitor-rule-gen__list_rules(scope?)         : existing rules with name and trigger — call this to avoid proposing duplicates.

You also have Read/Glob/Grep to inspect workspace files (e.g., read package.json to confirm real script names before writing commandMatches).

Suggested workflow:
  1. Call get_task_summary to understand the task at a glance.
  2. Call get_task_events to see the full event sequence and identify recurring patterns.
  3. Call list_rules to check what rules already exist.
  4. Optionally Read package.json (or equivalent manifest) to verify actual command names.
  5. Propose rules grounded in what you observed.

Propose 3-5 rules that would catch whether a future agent doing similar work performed it correctly. Rules are matched against tool-call events later — they describe what to expect, not what is forbidden.

Rules are not blockers. severity is always "info" — these are reminders, never gates.

Each rule has:
  - name           : short imperative (under 60 chars)
  - trigger        : { phrases: string[] }  -- optional; phrases match user/assistant text (case-insensitive substring)
  - triggerOn      : "user" | "assistant"   -- optional; defaults to either
  - expect         : at least one of:
                     - action: "command" | "file-read" | "file-write" | "web"
                     - commandMatches: string[]   (substring on shell command, case-insensitive)
                     - pattern: string            (regex on file path or shell command)
  - rationale      : 1 short sentence tying back to evidence (under 200 chars)

Guidelines:
  - These rules will be saved as TASK-SCOPED rules attached to this specific task. The user can promote them to global later if they prove useful across multiple tasks.
  - Prefer commandMatches over regex when you know the literal command (e.g., "npm test", "cargo clippy", "pytest").
  - If the task touched a specific area (e.g., auth code, migrations), trigger phrases should reflect that area.
  - Lean into task-specific patterns rather than generic project-wide habits — the latter belong in /setup-rules.
  - Quality over quantity: 3-5 rules. Skip if the task is too thin to learn from.

Return the rules as structured output conforming to the provided schema.`;
}

export function buildUserPrompt(
    taskId: string,
    maxRules: number,
    language: RuleSuggestionLanguage,
): string {
    const lines: string[] = [];
    lines.push(`Task ID: ${taskId}`);
    lines.push("");
    lines.push(`Output language: ${LANGUAGE_DIRECTIVES[language]}`);
    lines.push('  - This applies ONLY to the human-facing "name" and "rationale" fields.');
    lines.push('  - Keep "trigger.phrases", "expect.commandMatches", and "expect.pattern" as literal strings drawn from the actual transcripts and shell commands — translating them would break case-insensitive substring matching at runtime.');
    lines.push("");
    lines.push(`Propose up to ${maxRules} rules for task ${taskId}.`);
    return lines.join("\n");
}
