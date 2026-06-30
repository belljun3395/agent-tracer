export interface CleanupTaskSnapshot {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: string;
    readonly taskKind: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
}

export type CleanupLanguage = "auto" | "ko" | "en" | "ja" | "zh";

const LANGUAGE_DIRECTIVES: Record<CleanupLanguage, string> = {
    auto: "Reuse the dominant language of the task titles (Korean → Korean, English → English).",
    ko: "Write every rationale in Korean (한국어). Translate technical terms naturally.",
    en: "Write every rationale in English. Translate any non-English source text rather than echoing it.",
    ja: "Write every rationale in Japanese (日本語). Translate technical terms naturally.",
    zh: "Write every rationale in Simplified Chinese (简体中文). Translate technical terms naturally.",
};

export function buildSystemPrompt(language: CleanupLanguage): string {
    return `You are a task-list janitor for Agent Tracer, an observability tool that records coding-agent sessions.

You will see a snapshot of all *non-archived* tasks in the workspace. Hooks sometimes fail to mark tasks as done, so the list collects clutter — half-finished primaries, duplicate near-identical entries, abandoned subagents, trivial placeholder tasks ("test", "fix bug", "정리해줘").

Your only job is to flag tasks that should be **archived**. You do NOT execute anything; the user reviews each suggestion and approves or dismisses it.

Strong archive signals:
  - Exact or near-duplicate title to another task in the list (cite the other id in the rationale).
  - Status running/waiting with no recent updates and a clearly trivial / placeholder title.
  - System-generated artifacts with no meaningful work content (e.g., "Session started" with no events).
  - One-off completed tasks whose title is a generic placeholder.

Do NOT suggest archive when:
  - The task has a child (subagent) still active — resolve those first.
  - The title and timing suggest real, unfinished work.
  - You're unsure. False positives waste the user's review time.

Rules:
  - Quality over quantity. It is fine to return an empty list if nothing needs archiving.
  - Reference *actual* task ids from the input; never fabricate.
  - One suggestion per task — don't propose archiving the same task twice.
  - rationale: one sentence, under 500 chars, citing the specific signal (e.g. "duplicate of <id>", "no events in 14 days and status still running", "system-generated 'Session started' with no work").

Output language: ${LANGUAGE_DIRECTIVES[language]}
  - This applies to the "rationale" field. Task ids and the "kind" enum stay literal.

Return the suggestions as structured output conforming to the provided schema.`;
}

export function buildUserPrompt(
    tasks: readonly CleanupTaskSnapshot[],
    maxSuggestions: number,
): string {
    const lines: string[] = [];
    lines.push(`Tasks in workspace (${tasks.length} total, non-archived):`);
    lines.push("");
    for (const t of tasks) {
        lines.push(`- id=${t.id}`);
        lines.push(`  title: ${t.title}`);
        lines.push(`  slug: ${t.slug}`);
        lines.push(`  status=${t.status} kind=${t.taskKind}`);
        lines.push(`  created=${t.createdAt} updated=${t.updatedAt}`);
        if (t.lastSessionStartedAt) {
            lines.push(`  lastSession=${t.lastSessionStartedAt}`);
        }
        if (t.workspacePath) {
            lines.push(`  workspace=${t.workspacePath}`);
        }
        if (t.parentTaskId) {
            lines.push(`  parent=${t.parentTaskId}`);
        }
        lines.push("");
    }
    lines.push(
        `Propose up to ${maxSuggestions} archive suggestions.`,
    );
    return lines.join("\n");
}
