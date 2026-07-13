import {inferCommandSemantic} from "~runtime/domain/ingest/model/command.semantic.model.js";
import {
    KIND,
    LANE,
    MONITOR_TOOL_NAME,
    POWERSHELL_TOOL_NAME,
    TERMINAL_COMMAND_TOOL_NAME,
    provenEvidence,
} from "~runtime/domain/ingest/model/event.model.js";
import {collectFileTargets, toOptionalNumber} from "~runtime/domain/ingest/model/file.target.model.js";
import {captureTerminalToolResponse} from "~runtime/domain/ingest/model/tool.capture.model.js";
import {toolUseIdOf, type ShapedToolEvent, type ToolCall} from "~runtime/domain/ingest/model/tool.call.model.js";
import {buildSemanticMetadata} from "~runtime/domain/ingest/model/tool.semantic.model.js";
import type {
    TerminalCommandMetadata,
    ToolUsedMetadata,
} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import {toBoolean, toTrimmedString, truncate} from "~runtime/support/text.js";

const TITLE_MAX = 80;

/** Bash와 PowerShell 명령을 같은 조형 규칙으로 원장 이벤트로 만든다. */
export function shapeTerminalCommand(call: ToolCall): ShapedToolEvent | null {
    const command = toTrimmedString(call.toolInput["command"]);
    if (!command) return null;

    const isPowerShell = call.toolName === POWERSHELL_TOOL_NAME;
    const toolName = isPowerShell ? POWERSHELL_TOOL_NAME : TERMINAL_COMMAND_TOOL_NAME;
    const description = toTrimmedString(call.toolInput["description"]);
    const timeoutMs = toOptionalNumber(call.toolInput["timeout"]);
    const runInBackground = toBoolean(call.toolInput["run_in_background"]);
    const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);
    const filePaths = collectFileTargets(analysis);
    const captured = captureTerminalToolResponse(call.toolResponse);
    const prompt = isPowerShell ? ">" : "$";

    const metadata: TerminalCommandMetadata = {
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        ...buildSemanticMetadata({...semantic, sourceTool: toolName}),
        toolName,
        command,
        commandAnalysis: analysis,
        ...(description ? {description} : {}),
        ...(timeoutMs !== undefined ? {timeoutMs} : {}),
        ...(runInBackground ? {runInBackground: true} : {}),
        ...toolUseIdOf(call),
        ...captured,
    };

    return {
        kind: KIND.executeTool,
        lane,
        title: description || truncate(command, TITLE_MAX),
        body: description ? `${description}\n\n${prompt} ${command}` : command,
        ...(filePaths.length > 0 ? {filePaths} : {}),
        metadata,
    };
}

/** 백그라운드 셸의 출력 읽기와 종료를 원장 이벤트로 만든다. */
export function shapeBackgroundShell(call: ToolCall): ShapedToolEvent {
    const bashId = toTrimmedString(call.toolInput["bash_id"]) || "?";
    const isRead = call.toolName === "BashOutput";
    const filter = isRead ? toTrimmedString(call.toolInput["filter"]) : "";

    const metadata: ToolUsedMetadata = {
        ...provenEvidence(`Observed directly by the ${call.toolName} PostToolUse hook.`),
        ...buildSemanticMetadata({
            subtypeKey: isRead ? "shell_probe" : "run_command",
            subtypeLabel: isRead ? "Background shell read" : "Kill background shell",
            subtypeGroup: isRead ? "shell" : "execution",
            toolFamily: "terminal",
            operation: isRead ? "read" : "execute",
            entityType: "shell",
            entityName: bashId,
            sourceTool: call.toolName,
        }),
        toolName: call.toolName,
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.executeTool,
        lane: isRead ? LANE.exploration : LANE.implementation,
        title: isRead ? `BashOutput: ${bashId}${filter ? ` /${filter}/` : ""}` : `KillShell: ${bashId}`,
        body: isRead
            ? `Read output from background shell ${bashId}${filter ? ` (filter ${filter})` : ""}`
            : `Terminated background shell ${bashId}`,
        metadata,
    };
}

/** 출력이 계속 되먹이는 Monitor 도구를 지속 관찰 이벤트로 만든다. */
export function shapeMonitorCommand(call: ToolCall): ShapedToolEvent {
    const script = toTrimmedString(call.toolInput["command"]);
    const description = toTrimmedString(call.toolInput["description"]);

    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the Monitor PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "shell_probe",
            subtypeLabel: "Monitor watch",
            subtypeGroup: "shell",
            toolFamily: "terminal",
            operation: "monitor",
            entityType: "command",
            entityName: script.split(/\s+/)[0] || "monitor",
            sourceTool: MONITOR_TOOL_NAME,
        }),
        toolName: MONITOR_TOOL_NAME,
        ...(script ? {monitorScript: script} : {}),
        ...(description ? {monitorDescription: description} : {}),
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.executeTool,
        lane: LANE.background,
        title: description || `Monitor: ${truncate(script, 60)}`,
        body: description ? `${description}\n\n$ ${script}` : script,
        metadata,
    };
}
