import type { EvaluateTurnToolCall } from "../verdict/turn.evaluation.js";
import { normalizeVerificationToolName } from "./tool-action.matching.js";

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
    const toolName = readString(event.metadata, "toolName") ?? readString(event.metadata, "sourceTool");
    if (toolName) {
        return buildToolCall(toolName, event.metadata);
    }
    const semanticTool = inferSemanticTool(event.kind, event.metadata);
    if (semanticTool) {
        return buildToolCall(semanticTool, event.metadata);
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
        tool: normalizeVerificationToolName(tool),
        ...(command !== undefined ? { command } : {}),
        ...(filePath !== undefined ? { filePath } : {}),
    };
}

function inferSemanticTool(kind: string, metadata: Record<string, unknown>): string | null {
    const subtypeKey = normalizeToken(readString(metadata, "subtypeKey"));
    if (subtypeKey) {
        if (["runcommand", "runtest", "runbuild", "runlint", "verify", "shellprobe"].includes(subtypeKey)) {
            return "command";
        }
        if (subtypeKey === "readfile") return "file-read";
        if (["modifyfile", "createfile", "deletefile", "renamefile", "applypatch"].includes(subtypeKey)) {
            return "file-write";
        }
        if (subtypeKey === "websearch" || subtypeKey === "webfetch") return "web";
    }

    const toolFamily = normalizeToken(readString(metadata, "toolFamily"));
    const operation = normalizeToken(readString(metadata, "operation"));
    if (toolFamily === "terminal") return "command";
    if (toolFamily === "file") return operation === "observe" || operation === "read" ? "file-read" : "file-write";
    if (toolFamily === "web") return "web";
    return kind === "terminal.command" ? "command" : null;
}

function readString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeToken(value: string | undefined): string {
    return (value ?? "").toLowerCase().replace(/[\s._-]+/g, "");
}
