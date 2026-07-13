import * as path from "node:path";
import {KIND, LANE, provenEvidence} from "~runtime/domain/ingest/model/event.model.js";
import {captureToolResultBody} from "~runtime/domain/ingest/model/tool.capture.model.js";
import {
    toolUseIdOf,
    type ShapedToolEvent,
    type ToolCall,
    type ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import type {ToolUsedMetadata} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import {buildSemanticMetadata, inferFileToolSemantic} from "~runtime/domain/ingest/model/tool.semantic.model.js";
import {relativeProjectPath} from "~runtime/domain/ingest/model/workspace.path.model.js";
import {toBoolean, toTrimmedString} from "~runtime/support/text.js";

export const FILE_TOOLS = ["Edit", "Write", "NotebookEdit"] as const;

/** Edit·Write·NotebookEdit를 파일 수정 이벤트로 만든다. */
export function shapeFileTool(call: ToolCall, context: ToolShapeContext): ShapedToolEvent {
    const toolName = call.toolName;
    const filePath = readFilePath(call);
    const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
    const semantic = inferFileToolSemantic(toolName, relPath || undefined);
    const editReplaceAll = toolName === "Edit" && toBoolean(call.toolInput["replace_all"]);

    const metadata: ToolUsedMetadata = {
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        ...buildSemanticMetadata(semantic),
        toolName,
        ...(filePath ? {filePath, relPath} : {}),
        ...(editReplaceAll ? {editReplaceAll: true} : {}),
        ...toolUseIdOf(call),
        ...captureToolResultBody(call.toolResponse),
    };

    return {
        kind: KIND.executeTool,
        lane: LANE.implementation,
        title: relPath ? `${toolName}: ${path.basename(relPath)}` : toolName,
        body: relPath ? `Modified ${relPath}` : `Used ${toolName}`,
        ...(filePath ? {filePaths: [filePath]} : {}),
        metadata,
    };
}

function readFilePath(call: ToolCall): string {
    return toTrimmedString(call.toolInput["file_path"])
        || toTrimmedString(call.toolInput["notebook_path"])
        || toTrimmedString(call.toolInput["path"]);
}
