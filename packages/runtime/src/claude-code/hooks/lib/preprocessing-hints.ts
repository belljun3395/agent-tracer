/**
 * Helpers for fetching preprocessing hints from the monitor and rendering
 * them into the `hookSpecificOutput.additionalContext` JSON that Claude Code
 * prepends to the next turn. Hooks that want to surface hints should call
 * `emitPreprocessingHints` after they finish their own event recording.
 *
 * Errors are intentionally swallowed and logged — preprocessing is a soft
 * augmentation, never a blocker. If the monitor is slow or unreachable the
 * hook still exits 0.
 */
import {postJson} from "~claude-code/hooks/lib/transport/transport.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

export type PreprocessingHintTrigger = "user_prompt" | "pre_tool";
export type PreprocessingHintSeverity = "info" | "warning" | "critical";
export type PreprocessingHintType =
    | "context_pressure"
    | "duplicate_question"
    | "command_repetition"
    | "destructive_risk";

export interface PreprocessingHint {
    readonly type: PreprocessingHintType;
    readonly severity: PreprocessingHintSeverity;
    readonly title: string;
    readonly message: string;
}

interface PreprocessingHintsRequest {
    readonly trigger: PreprocessingHintTrigger;
    readonly toolName?: string;
    readonly command?: string;
    readonly questions?: readonly string[];
}

interface PreprocessingHintsResponse {
    readonly hints?: readonly PreprocessingHint[];
}

export async function fetchPreprocessingHints(
    taskId: string,
    request: PreprocessingHintsRequest,
): Promise<readonly PreprocessingHint[]> {
    if (!taskId) return [];
    try {
        const response = await postJson<PreprocessingHintsResponse>(
            `/api/v1/tasks/${encodeURIComponent(taskId)}/preprocessing-hints`,
            request,
        );
        const hints = response.hints;
        if (!Array.isArray(hints)) return [];
        const validated: PreprocessingHint[] = [];
        for (const candidate of hints as readonly unknown[]) {
            if (!candidate || typeof candidate !== "object") continue;
            const h = candidate as Record<string, unknown>;
            if (typeof h["type"] !== "string"
                || typeof h["severity"] !== "string"
                || typeof h["title"] !== "string"
                || typeof h["message"] !== "string") continue;
            validated.push(candidate as PreprocessingHint);
        }
        return validated;
    } catch (err) {
        hookLog("preprocessing-hints", "fetch failed", {error: String(err)});
        return [];
    }
}

/**
 * Writes Claude Code's `hookSpecificOutput.additionalContext` JSON to stdout
 * so the hints are prepended to the upcoming turn. Returns true if any hint
 * was surfaced.
 */
export function emitPreprocessingHints(
    hookEventName: "UserPromptSubmit" | "PreToolUse",
    hints: readonly PreprocessingHint[],
): boolean {
    if (hints.length === 0) return false;
    const additionalContext = formatHintsContext(hints);
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

function formatHintsContext(hints: readonly PreprocessingHint[]): string {
    const lines: string[] = ["<agent-tracer-preprocessing>"];
    for (const hint of hints) {
        const icon = hint.severity === "critical" ? "⛔"
            : hint.severity === "warning" ? "⚠️"
            : "ℹ️";
        lines.push(`${icon} [${hint.type}] ${hint.title}`);
        lines.push(`   ${hint.message}`);
    }
    lines.push("</agent-tracer-preprocessing>");
    return lines.join("\n");
}
