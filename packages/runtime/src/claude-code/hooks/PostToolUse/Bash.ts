/**
 * Claude Code Hook: PostToolUse — matcher: "Bash"
 *
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * Fires after a Bash tool call succeeds. Does not fire on failures
 * (see PostToolUseFailure.ts).
 *
 * Bash tool_input fields:
 *   command          string   — shell command to run
 *   description      string?  — human-readable description
 *   timeout          number?  — timeout in ms
 *   run_in_background boolean? — async execution flag
 *
 * This handler posts a /ingest/v1/events event with kind "terminal.command"
 * and attaches the runtime-derived lane + semantic metadata.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import type { TerminalCommandMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferCommandSemantic } from "~shared/semantics/inference.command.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("Bash", async ({payload, ids}) => {
    const command = toTrimmedString(payload.toolInput["command"]);
    if (!command) return;

    const description = toTrimmedString(payload.toolInput["description"]);
    const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);

    const metadata: TerminalCommandMetadata = {
        ...provenEvidence("Observed directly by the Bash PostToolUse hook."),
        ...buildSemanticMetadata(semantic),
        command,
        commandAnalysis: analysis,
        ...(description ? {description} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.terminalCommand,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane,
        title: description || command.slice(0, 80),
        body: description ? `${description}\n\n$ ${command}` : command,
        metadata,
    });
});
