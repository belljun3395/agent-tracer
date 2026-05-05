/**
 * Claude Code Hook: PostToolUse — matcher: "PowerShell"
 *
 * PowerShell on Windows runs in place of Bash. Same semantic shape — same
 * inferCommandSemantic dispatch. We re-implement the small Bash handler
 * here rather than importing it because each hook entrypoint must be its
 * own top-level await module under the file-name = matcher convention.
 */
import {toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import type { TerminalCommandMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferCommandSemantic } from "~shared/semantics/inference.command.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("PowerShell", async ({payload, ids}) => {
    const command = toTrimmedString(payload.toolInput["command"]);
    if (!command) return;

    const description = toTrimmedString(payload.toolInput["description"]);
    const runInBackground = toBoolean(payload.toolInput["run_in_background"]);
    const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);

    const metadata: TerminalCommandMetadata = {
        ...provenEvidence("Observed directly by the PowerShell PostToolUse hook."),
        ...buildSemanticMetadata({...semantic, sourceTool: "PowerShell"}),
        command,
        commandAnalysis: analysis,
        ...(description ? {description} : {}),
        ...(runInBackground ? {runInBackground: true} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.terminalCommand,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane,
        title: description || command.slice(0, 80),
        body: description ? `${description}\n\n> ${command}` : command,
        metadata,
    });
});
