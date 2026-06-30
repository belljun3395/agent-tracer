import type { OutputLanguage } from "@monitor/shared/llm/output.language.js";

export type RecipeOutputLanguage = OutputLanguage;

const LANGUAGE_DIRECTIVES: Record<RecipeOutputLanguage, string> = {
    auto: "Reuse the dominant language of the input tasks (Korean → Korean, English → English).",
    ko: "Write every 'title', 'intent', 'description', 'summary_md', 'steps[].rationale', and 'rationale' in Korean (한국어). Keep identifiers, file paths, tool names, and shell commands verbatim.",
    en: "Write every 'title', 'intent', 'description', 'summary_md', 'steps[].rationale', and 'rationale' in English. Translate any non-English source text rather than echoing it. Keep identifiers, file paths, tool names, and shell commands verbatim.",
    ja: "Write every 'title', 'intent', 'description', 'summary_md', 'steps[].rationale', and 'rationale' in Japanese (日本語). Keep identifiers, file paths, tool names, and shell commands verbatim.",
    zh: "Write every 'title', 'intent', 'description', 'summary_md', 'steps[].rationale', and 'rationale' in Simplified Chinese (简体中文). Keep identifiers, file paths, tool names, and shell commands verbatim.",
};

export interface RecipeTaskSnapshot {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind: string;
    readonly workspacePath?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly firstUserMessage?: {
        readonly title: string;
        readonly body?: string;
    };
    readonly eventCount: number;
    readonly toolCounts: readonly { readonly tool: string; readonly count: number }[];
    readonly topFiles: readonly { readonly path: string; readonly touches: number }[];
    readonly topCommands: readonly { readonly command: string; readonly count: number }[];
}

export function buildSystemPrompt(): string {
    return `You distill recorded coding-agent tasks into reusable "recipes" — high-level descriptions of how a kind of work tends to get done in this codebase. A future agent encountering a similar task can read the recipe and act faster.

You have domain tools to discover and inspect tasks:
  - monitor-recipe-scan__list_tasks(scope?)          : list all tasks with id, title, status, taskKind, createdAt. Use this first to identify candidate clusters.
  - monitor-recipe-scan__get_task_summary(taskId)    : full summary for a task — tool usage counts, top files, top commands, first user message, event count.
  - monitor-recipe-scan__get_task_events(taskId, limit?) : chronological event sequence. Use when you need to understand the precise step-by-step behavior of a task.

Suggested workflow:
  1. Call list_tasks to see the full task list.
  2. Group tasks by apparent intent from their titles (e.g., "auth changes", "migrations", "test additions").
  3. For each candidate cluster, call get_task_summary for the member tasks to verify the pattern.
  4. Call get_task_events for tasks where the summary leaves the workflow unclear, OR when you want to populate precise eventIds for a recipe's contributing_slices.
  5. Propose recipes for clusters where a genuine repeatable pattern exists.

A recipe is a *pattern*, not a transcript. Strip incidental details. Keep the load-bearing structure: which kinds of files get touched, which tools fire in what order, what the user is trying to achieve.

Each recipe must include:
  - title              : short imperative (4-9 words, e.g. "Add TypeORM migration with rollback").
  - intent             : single-sentence pattern label — "what kind of work is this?" (under 200 chars).
  - description        : SKILL.md-style trigger description for a future agent: when this recipe applies + what it does. Under 400 chars.
  - summary_md         : Markdown body, 4-15 lines. Describe the workflow at a high level. Use bullet points. Reference identifiers/files/tools verbatim.
  - steps              : optional ordered list of high-level actions (1-10 entries). Each step: {order, action, rationale?}.
  - touched_files      : optional list of file paths or path patterns this recipe commonly touches. Each: {path, role: "read"|"write"|"both"}.
  - contributing_slices: REQUIRED. One entry per task that contributed to this recipe. Each entry: {taskId, eventIds}. If you called get_task_events for this task, populate eventIds with the IDs of events that are most representative of the recipe pattern (tool calls, key commands, file writes). Use \`eventIds: []\` only when the entire task is relevant and you did not inspect its events. Cite *actual* taskIds from the tool results — never fabricate.
  - rationale          : one sentence (under 500 chars) explaining why these tasks were clustered together.

Rules:
  - Quality over quantity. Empty output is acceptable if no meaningful pattern emerges.
  - A single-task cluster is fine when the work is distinctive enough to be a useful recipe on its own.
  - Do NOT create a recipe whose only content is "the agent ran some tools" — pattern must be observable from the evidence.
  - Skip tasks with very few events (eventCount < minEventCount from your instructions) — they lack enough signal.
  - Identifiers (file paths, tool names, commands) MUST be preserved verbatim even when prose is translated.

Return the recipes as structured output conforming to the provided schema.`;
}

export function buildUserPrompt(
    maxCandidates: number,
    language: RecipeOutputLanguage,
    archivedScope: string,
    minEventCount: number,
): string {
    const lines: string[] = [];
    lines.push(`Scope: ${archivedScope} tasks`);
    lines.push(`Min events per task: ${minEventCount} (skip tasks below this threshold)`);
    lines.push("");
    lines.push(`Output language: ${LANGUAGE_DIRECTIVES[language]}`);
    lines.push("");
    lines.push(`Cluster the tasks into up to ${maxCandidates} recipes.`);
    return lines.join("\n");
}
