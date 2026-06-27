import type { OutputLanguage } from "@monitor/shared/llm/output.language.js";
import type { TaskSummaryUseCaseDto } from "@monitor/run-api/task/application/dto/get.task.summary.usecase.dto.js";

export type SuggestionLanguage = OutputLanguage;

const LANGUAGE_DIRECTIVES: Record<SuggestionLanguage, string> = {
    auto: "Reuse the user's language: mirror the language of the existing title and first user message (Korean → Korean, English → English, etc.).",
    ko: "Write every title and rationale in Korean (한국어). Translate names and keywords as needed.",
    en: "Write every title and rationale in English. Translate any non-English source text rather than echoing it.",
    ja: "Write every title and rationale in Japanese (日本語). Translate names and keywords as needed.",
    zh: "Write every title and rationale in Simplified Chinese (简体中文). Translate names and keywords as needed.",
};

export function buildSystemPrompt(language: SuggestionLanguage): string {
    return `You rename recorded coding-agent tasks so the title actually reflects what happened.

You will see the task's current title and a summary of its activity (first user message, top tools used, top files touched, top shell commands). Propose 2-3 alternative titles.

Each title:
  - 4-9 words, imperative or noun-phrase form (e.g. "Fix auth middleware token leak", "Migrate billing schema to v2").
  - Concrete: name the area or action — no "Task 123", "Untitled", "Test", or other placeholders.
  - Under 80 characters.

Output language: ${LANGUAGE_DIRECTIVES[language]}

Rules:
  - If the existing title already reads cleanly, return an empty list — don't manufacture changes.
  - Don't repeat the existing title.
  - rationale: one short sentence per suggestion explaining what evidence drove it (under 200 chars).

Return the suggestions as structured output conforming to the provided schema.`;
}

export function buildUserPrompt(summary: TaskSummaryUseCaseDto): string {
    const lines: string[] = [];
    lines.push(`Current title: ${summary.title}`);
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
        for (const tc of summary.toolCounts.slice(0, 8)) {
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
        for (const c of summary.topCommands.slice(0, 8)) {
            lines.push(`  - ${c.command} (${c.count}x)`);
        }
    }
    lines.push("");
    lines.push("Propose 2-3 alternative titles.");
    return lines.join("\n");
}
