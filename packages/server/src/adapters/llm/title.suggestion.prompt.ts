import type { TaskSummaryUseCaseDto } from "~work/task/application/dto/get.task.summary.usecase.dto.js";

export const SYSTEM_PROMPT = `You rename recorded coding-agent tasks so the title actually reflects what happened.

You will see the task's current title and a summary of its activity (first user message, top tools used, top files touched, top shell commands). Propose 2-3 alternative titles.

Each title:
  - 4-9 words, imperative or noun-phrase form (e.g. "Fix auth middleware token leak", "Migrate billing schema to v2").
  - Concrete: name the area or action — no "Task 123", "Untitled", "Test", or other placeholders.
  - Reuse the user's language: if the original title and first user message are in Korean, write the suggestions in Korean. If they're in English, English.
  - Under 80 characters.

Rules:
  - If the existing title already reads cleanly, return an empty list — don't manufacture changes.
  - Don't repeat the existing title.
  - rationale: one short sentence per suggestion explaining what evidence drove it (under 200 chars).

Output STRICT JSON ONLY in this shape — no prose, no markdown, no backticks:
{ "suggestions": [
    { "title": "...", "rationale": "..." }
] }`;

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
    lines.push("Propose 2-3 alternative titles. Output JSON only.");
    return lines.join("\n");
}
