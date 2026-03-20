import path from "node:path";

import {
  CLAUDE_RUNTIME,
  ensureRuntimeSession,
  getHookEventName,
  getSessionId,
  getToolInput,
  parseMcpToolName,
  postJson,
  readStdinJson,
  relativeProjectPath,
  toBoolean,
  toTrimmedString
} from "./common.js";

function filePathFromToolInput(toolInput: Record<string, unknown>): string {
  return toTrimmedString(toolInput.file_path)
    || toTrimmedString(toolInput.path)
    || toTrimmedString(toolInput.pattern);
}

async function main(): Promise<void> {
  if (!CLAUDE_RUNTIME) return;

  const payload = await readStdinJson();
  const hookEventName = getHookEventName(payload) || "PostToolUse";
  const toolName = toTrimmedString(payload.tool_name);
  const toolInput = getToolInput(payload);
  const sessionId = getSessionId(payload);

  if (!sessionId || !toolName) return;

  const ids = await ensureRuntimeSession(sessionId);
  const filePath = filePathFromToolInput(toolInput);
  const relPath = filePath ? relativeProjectPath(filePath) : "";
  const mcpTool = parseMcpToolName(toolName);

  let title = relPath ? `${toolName}: ${path.basename(relPath)}` : toolName;
  let body = relPath ? `Modified ${relPath}` : `Used ${toolName}`;
  let lane: "implementation" | "coordination" | undefined = "implementation";
  const metadata: Record<string, unknown> = {};

  if (toolName === "Bash") {
    const description = toTrimmedString(toolInput.description);
    metadata.description = description;
  } else if (mcpTool) {
    title = `MCP: ${mcpTool.server}/${mcpTool.tool}`;
    body = `Used MCP tool ${mcpTool.server}/${mcpTool.tool}`;
    lane = "coordination";
    metadata.mcpServer = mcpTool.server;
    metadata.mcpTool = mcpTool.tool;
  }

  if (hookEventName === "PostToolUseFailure") {
    title = `Failed ${toolName}`;
    body = toTrimmedString(payload.error) || `Tool failed: ${toolName}`;
    metadata.failed = true;
    metadata.error = toTrimmedString(payload.error);
    metadata.isInterrupt = toBoolean(payload.is_interrupt);
  } else if (filePath) {
    metadata.filePath = filePath;
    metadata.relPath = relPath;
  }

  await postJson("/api/tool-used", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    toolName,
    title,
    body,
    ...(lane ? { lane } : {}),
    ...(filePath && hookEventName !== "PostToolUseFailure" ? { filePaths: [filePath] } : {}),
    metadata
  });
}

void main().catch(() => {});
