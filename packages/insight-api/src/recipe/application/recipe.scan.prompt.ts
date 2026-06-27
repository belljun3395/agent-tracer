export type RecipeOutputLanguage = "auto" | "ko" | "en" | "ja" | "zh";

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

You will see a batch of completed/active tasks with their tool usage, files touched, and the first user message. Cluster tasks that share an intent and emit one recipe per cluster.

A recipe is a *pattern*, not a transcript. Strip incidental details. Keep the load-bearing structure: which kinds of files get touched, which tools fire in what order, what the user is trying to achieve.

Each recipe must include:
  - title              : short imperative (4-9 words, e.g. "Add TypeORM migration with rollback").
  - intent             : single-sentence pattern label — "what kind of work is this?" (under 200 chars).
  - description        : SKILL.md-style trigger description for a future agent: when this recipe applies + what it does. Under 400 chars.
  - summary_md         : Markdown body, 4-15 lines. Describe the workflow at a high level. Use bullet points. Reference identifiers/files/tools verbatim.
  - steps              : optional ordered list of high-level actions (1-10 entries). Each step: {order, action, rationale?}.
  - touched_files      : optional list of file paths or path patterns this recipe commonly touches. Each: {path, role: "read"|"write"|"both"}.
  - contributing_slices: REQUIRED. One entry per task that contributed to this recipe. Each entry: {taskId, eventIds}. Use \`eventIds: []\` to mean "the entire task". Cite *actual* taskIds from the input — never fabricate.
  - rationale          : one sentence (under 500 chars) explaining why these tasks were clustered together.

Rules:
  - Quality over quantity. Empty output is acceptable if no meaningful pattern emerges.
  - A single-task cluster is fine when the work is distinctive enough to be a useful recipe on its own.
  - Do NOT create a recipe whose only content is "the agent ran some tools" — pattern must be observable from the evidence.
  - Identifiers (file paths, tool names, commands) MUST be preserved verbatim even when prose is translated.

Return the recipes as structured output conforming to the provided schema.`;
}

export function buildUserPrompt(
    tasks: readonly RecipeTaskSnapshot[],
    maxCandidates: number,
    language: RecipeOutputLanguage,
): string {
    const lines: string[] = [];
    lines.push(`Candidate tasks (${tasks.length} total):`);
    lines.push("");
    for (const t of tasks) {
        lines.push(`- id=${t.id}`);
        lines.push(`  title: ${t.title}`);
        lines.push(`  status=${t.status} kind=${t.taskKind}`);
        lines.push(`  created=${t.createdAt} updated=${t.updatedAt}`);
        if (t.workspacePath) {
            lines.push(`  workspace=${t.workspacePath}`);
        }
        if (t.firstUserMessage) {
            lines.push(`  first user message:`);
            lines.push(`    "${truncate(t.firstUserMessage.title, 240)}"`);
            if (t.firstUserMessage.body) {
                lines.push(`    body: ${truncate(t.firstUserMessage.body, 800)}`);
            }
        }
        lines.push(`  eventCount=${t.eventCount}`);
        if (t.toolCounts.length > 0) {
            const top = t.toolCounts
                .slice(0, 8)
                .map((tc) => `${tc.tool}×${tc.count}`)
                .join(", ");
            lines.push(`  tools: ${top}`);
        }
        if (t.topFiles.length > 0) {
            lines.push(`  files:`);
            for (const f of t.topFiles.slice(0, 5)) {
                lines.push(`    - ${f.path} (${f.touches}x)`);
            }
        }
        if (t.topCommands.length > 0) {
            lines.push(`  commands:`);
            for (const c of t.topCommands.slice(0, 5)) {
                lines.push(`    - ${truncate(c.command, 160)} (${c.count}x)`);
            }
        }
        lines.push("");
    }
    lines.push(`Output language: ${LANGUAGE_DIRECTIVES[language]}`);
    lines.push("");
    lines.push(
        `Cluster these tasks into up to ${maxCandidates} recipes.`,
    );
    return lines.join("\n");
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
}
