/**
 * Helper for fetching recipe matches from the monitor and rendering them
 * as `hookSpecificOutput.additionalContext`. Hooks call this AFTER any
 * preprocessing hint emission — both pieces of additional context can
 * coexist, but only one is emitted to stdout in this helper.
 *
 * Like preprocessing hints, errors are swallowed — recipes are a soft
 * augmentation, never a blocker.
 */
import {postJson} from "~claude-code/hooks/lib/transport/transport.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

interface RecipeMatch {
    readonly recipeId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly score: number;
    readonly applicationId?: string;
}

interface RecipeMatchResponse {
    readonly matches?: readonly RecipeMatch[];
}

export async function fetchRecipeMatches(
    prompt: string,
    options: {
        readonly taskId?: string;
        readonly injectedVia?: "auto" | "slash_command" | "manual";
        readonly limit?: number;
    } = {},
): Promise<readonly RecipeMatch[]> {
    if (!prompt.trim()) return [];
    try {
        const response = await postJson<RecipeMatchResponse>(
            `/api/v1/recipes/match`,
            {
                prompt,
                ...(options.taskId ? { taskId: options.taskId } : {}),
                ...(options.injectedVia ? { injectedVia: options.injectedVia } : {}),
                ...(options.limit ? { limit: options.limit } : {}),
            },
        );
        const matches = response.matches;
        if (!Array.isArray(matches)) return [];
        const validated: RecipeMatch[] = [];
        for (const candidate of matches as readonly unknown[]) {
            if (!candidate || typeof candidate !== "object") continue;
            const m = candidate as Record<string, unknown>;
            if (typeof m["recipeId"] !== "string"
                || typeof m["title"] !== "string"
                || typeof m["intent"] !== "string"
                || typeof m["description"] !== "string"
                || typeof m["summaryMd"] !== "string"
                || typeof m["score"] !== "number") continue;
            validated.push(candidate as RecipeMatch);
        }
        return validated;
    } catch (err) {
        hookLog("recipe-context", "match failed", {error: String(err)});
        return [];
    }
}

/**
 * Writes a `hookSpecificOutput.additionalContext` JSON line to stdout that
 * lists matched recipes. Returns true if anything was emitted.
 */
export function emitRecipeContext(
    hookEventName: "UserPromptSubmit",
    matches: readonly RecipeMatch[],
): boolean {
    if (matches.length === 0) return false;
    const additionalContext = formatRecipeContext(matches);
    if (!additionalContext) return false;
    const output = {
        hookSpecificOutput: {
            hookEventName,
            additionalContext,
        },
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return true;
}

function formatRecipeContext(matches: readonly RecipeMatch[]): string {
    const lines: string[] = ["<agent-tracer-recipes>"];
    lines.push(
        `Past patterns in this workspace that match this prompt (score 0..1):`,
    );
    for (const m of matches) {
        lines.push("");
        lines.push(`• ${m.title} (score ${m.score.toFixed(2)})`);
        lines.push(`  intent: ${m.intent}`);
        lines.push(`  ${m.description}`);
        const summary = m.summaryMd.trim();
        if (summary) {
            const compact = summary.length > 600
                ? summary.slice(0, 600) + "…"
                : summary;
            for (const ln of compact.split("\n")) {
                lines.push(`  ${ln}`);
            }
        }
    }
    lines.push("</agent-tracer-recipes>");
    return lines.join("\n");
}
