import { KIND, TERMINAL_COMMAND_TOOL_NAME } from "@monitor/timeline-api/public/types/event.const.js";
import type { EvaluateTurnToolCall } from "./turn.evaluation.policy.js";
import { normalizeVerificationToolName } from "./tool.action.matching.policy.js";

export function inferToolCall(event: {
    readonly kind: string;
    readonly metadata: Record<string, unknown>;
}): EvaluateTurnToolCall | null {
    const toolName = readString(event.metadata, "toolName") ?? readString(event.metadata, "sourceTool");
    if (toolName) {
        return buildToolCall(toolName, event.metadata);
    }
    const semanticTool = inferSemanticTool(event.metadata);
    if (semanticTool) {
        return buildToolCall(semanticTool, event.metadata);
    }

    if (event.kind === KIND.terminalCommand) {
        return buildToolCall(TERMINAL_COMMAND_TOOL_NAME, event.metadata);
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

function inferSemanticTool(metadata: Record<string, unknown>): string | null {
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
    return null;
}

function readString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeToken(value: string | undefined): string {
    return (value ?? "").toLowerCase().replace(/[\s._-]+/g, "");
}
