/**
 * Shared file-tool PostToolUse event builder used by Edit.ts, Write.ts, and
 * NotebookEdit.ts. Each tool-specific file exists to satisfy the "PascalCase =
 * official tool identifier" convention while the heavy lifting lives here.
 *
 * Edit tool_input fields: file_path, old_string, new_string, replace_all?
 * Write tool_input fields: file_path, content
 * NotebookEdit tool_input fields: notebook_path, cell_id?, new_source, edit_mode?
 */
import * as path from "node:path";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferFileToolSemantic } from "~shared/semantics/inference.file.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

export async function postFileToolEvent({payload, ids}: PostToolUseHandlerArgs): Promise<void> {
    const toolName = payload.toolName;
    const filePath = toTrimmedString(payload.toolInput["file_path"])
        || toTrimmedString(payload.toolInput["notebook_path"])
        || toTrimmedString(payload.toolInput["path"])
        || "";
    const relPath = filePath ? relativeProjectPath(filePath) : "";
    const semantic = inferFileToolSemantic(toolName, relPath || undefined);
    const title = relPath ? `${toolName}: ${path.basename(relPath)}` : toolName;
    const body = relPath ? `Modified ${relPath}` : `Used ${toolName}`;
    const editReplaceAll = toolName === "Edit" ? toBoolean(payload.toolInput["replace_all"]) : undefined;

    const metadata: ToolUsedMetadata = {
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        ...buildSemanticMetadata(semantic),
        toolName,
        ...(filePath ? {filePath, relPath} : {}),
        ...(editReplaceAll ? {editReplaceAll: true} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.implementation,
        title,
        body,
        ...(filePath ? {filePaths: [filePath]} : {}),
        metadata,
    });
}
