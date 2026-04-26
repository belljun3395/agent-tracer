import type { EvaluateTurnToolCall } from "./evaluate.turn.js";

/**
 * Infer a tool-call shape from a timeline event for verification evaluation.
 *
 * Two paths:
 *   1. Explicit `metadata.toolName` (set by tool.used / agent.activity.logged
 *      ingest paths) — used as-is.
 *   2. Kind-based fallback for events whose metadata predates the toolName
 *      field. The Bash PostToolUse hook records `terminal.command` events
 *      with `command` but no `toolName`; without this fallback the
 *      evaluator would see zero Bash calls and mark every "ran tests"
 *      claim as contradicted.
 *
 * Returns `null` for events that cannot be mapped to a tool call (most
 * non-tool events: context.snapshot, user.message, assistant.response, etc.)
 */
export function inferToolCall(event: {
    readonly kind: string;
    readonly metadata: Record<string, unknown>;
}): EvaluateTurnToolCall | null {
    const toolName = event.metadata["toolName"];
    if (typeof toolName === "string" && toolName) {
        return buildToolCall(toolName, event.metadata);
    }
    // Kind-based fallback: terminal.command is emitted by the Bash hook.
    if (event.kind === "terminal.command") {
        return buildToolCall("Bash", event.metadata);
    }
    return null;
}

function buildToolCall(
    tool: string,
    metadata: Record<string, unknown>,
): EvaluateTurnToolCall {
    const command = typeof metadata["command"] === "string" ? metadata["command"] : undefined;
    const filePaths = metadata["filePaths"];
    const filePath = Array.isArray(filePaths) && typeof filePaths[0] === "string"
        ? filePaths[0]
        : typeof metadata["filePath"] === "string"
            ? metadata["filePath"]
            : undefined;
    return {
        tool,
        ...(command !== undefined ? { command } : {}),
        ...(filePath !== undefined ? { filePath } : {}),
    };
}
