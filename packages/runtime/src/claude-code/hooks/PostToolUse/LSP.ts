/**
 * Claude Code Hook: PostToolUse — matcher: "LSP"
 * Ref: https://code.claude.com/docs/en/tools-reference#lsp-tool-behavior
 *
 * LSP tool gives Claude code intelligence: jump-to-definition, find-references,
 * type info, list-symbols, find-implementations, call hierarchies. From a
 * verification standpoint this is the strongest "agent really understood the
 * code" signal — stronger than Read/Grep because it's semantic.
 *
 * Tool input fields (vary by sub-operation):
 *   operation    string — "definition" | "references" | "symbols" | …
 *   file_path    string?
 *   line, column number?
 *   symbol       string?
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("LSP", async ({payload, ids}) => {
    const operation = toTrimmedString(payload.toolInput["operation"]) || "lsp";
    const filePath = toTrimmedString(payload.toolInput["file_path"]);
    const symbol = toTrimmedString(payload.toolInput["symbol"]);
    const relPath = filePath ? relativeProjectPath(filePath) : "";
    const titleSuffix = symbol || relPath || "";
    const title = `LSP ${operation}${titleSuffix ? `: ${titleSuffix.slice(0, 60)}` : ""}`;
    const body = `LSP ${operation}${relPath ? ` in ${relPath}` : ""}${symbol ? ` for ${symbol}` : ""}`;

    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the LSP PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "grep_code",
            subtypeLabel: `LSP ${operation}`,
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: `lsp_${operation}`,
            entityType: symbol ? "symbol" : "file",
            ...(symbol ? {entityName: symbol} : relPath ? {entityName: relPath} : {}),
            sourceTool: "LSP",
        }),
        toolName: "LSP",
        toolInput: stringifyToolInput(payload.toolInput) as unknown as Record<string, unknown>,
        ...(filePath ? {filePath, relPath} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.exploration,
        title,
        body,
        ...(filePath ? {filePaths: [filePath]} : {}),
        metadata,
    });
});
