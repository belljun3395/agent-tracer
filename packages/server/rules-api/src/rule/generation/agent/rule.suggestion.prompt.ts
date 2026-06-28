import type { OutputLanguage } from "@monitor/shared/llm/output.language.js";
import type { TaskSummaryUseCaseDto } from "@monitor/run-api/task/application/dto/get.task.summary.usecase.dto.js";

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

Given a recorded task's summary and access to the workspace via Read/Glob/Grep, propose 3-5 rules that would catch whether a future agent doing similar work performed it correctly. Rules are matched against tool-call events later — they describe what to expect, not what is forbidden.

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
  - Use the task's actual workspace evidence. Read package.json / Cargo.toml / pyproject.toml / go.mod to learn the real script names rather than inventing commands.
  - Prefer commandMatches over regex when you know the literal command (e.g., "npm test", "cargo clippy", "pytest").
  - If the task touched a specific area (e.g., auth code, migrations), trigger phrases should reflect that area.
  - Lean into task-specific patterns (e.g., "rerun integration tests after editing auth/*") rather than generic project-wide habits — the latter belong in /setup-rules.
  - Do NOT suggest rules whose intent matches an existing rule (the caller will dedup by signature anyway, but try to avoid obvious duplicates).
  - Quality over quantity: 3-5 rules. Skip if the task is too thin to learn from.

Return the rules as structured output conforming to the provided schema.`;
}

export function buildUserPrompt(
    summary: TaskSummaryUseCaseDto,
    existingRuleNames: readonly string[],
    maxRules: number,
    language: RuleSuggestionLanguage,
): string {
    const lines: string[] = [];
    lines.push(`Task: ${summary.title}`);
    lines.push(`Status: ${summary.status}`);
    if (summary.workspacePath) {
        lines.push(`Workspace: ${summary.workspacePath}`);
    }
    if (summary.firstUserMessage) {
        lines.push("");
        lines.push("Initial user message:");
        lines.push(summary.firstUserMessage.title);
        if (summary.firstUserMessage.body) {
            lines.push(summary.firstUserMessage.body);
        }
    }
    lines.push("");
    lines.push(`Tool usage (${summary.eventCount} events total):`);
    if (summary.toolCounts.length === 0) {
        lines.push("  (no tool events)");
    } else {
        for (const tc of summary.toolCounts) {
            lines.push(`  - ${tc.tool}: ${tc.count}`);
        }
    }
    if (summary.topFiles.length > 0) {
        lines.push("");
        lines.push("Top files touched:");
        for (const f of summary.topFiles) {
            lines.push(`  - ${f.path} (${f.touches}x)`);
        }
    }
    if (summary.topCommands.length > 0) {
        lines.push("");
        lines.push("Top shell commands:");
        for (const c of summary.topCommands) {
            lines.push(`  - ${c.command} (${c.count}x)`);
        }
    }
    if (existingRuleNames.length > 0) {
        lines.push("");
        lines.push("Existing rules (avoid duplicating these):");
        for (const name of existingRuleNames.slice(0, 30)) {
            lines.push(`  - ${name}`);
        }
    }
    lines.push("");
    lines.push(`Output language: ${LANGUAGE_DIRECTIVES[language]}`);
    lines.push('  - This applies ONLY to the human-facing "name" and "rationale" fields.');
    lines.push('  - Keep "trigger.phrases", "expect.commandMatches", and "expect.pattern" as literal strings drawn from the actual transcripts and shell commands — translating them would break case-insensitive substring matching at runtime.');
    lines.push("");
    lines.push(`Propose up to ${maxRules} rules.`);
    return lines.join("\n");
}
