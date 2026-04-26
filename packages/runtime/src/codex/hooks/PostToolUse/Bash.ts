/**
 * Codex Hook: PostToolUse — matcher: "Bash"
 *
 * Ref: https://developers.openai.com/codex/hooks#posttooluse
 *
 * Stdin payload fields:
 *   session_id             string
 *   cwd                    string
 *   hook_event_name        string — "PostToolUse"
 *   model                  string
 *   turn_id                string
 *   tool_name              string — "Bash"
 *   tool_use_id            string
 *   tool_input.command     string
 *   tool_response          any
 *
 * Blocking: Yes (decision: "block" replaces tool result; does not undo it).
 * This handler never blocks.
 */
import {toTrimmedString} from "~codex/util/utils.js";
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexPostToolUse} from "~shared/hooks/codex/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import type { TerminalCommandMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferCommandSemantic } from "~shared/semantics/inference.command.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runHook("PostToolUse/Bash", {
    logger: codexHookRuntime.logger,
    parse: readCodexPostToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const command = toTrimmedString(payload.toolInput["command"]);
        if (!command) return;

        const description = toTrimmedString(payload.toolInput["description"]);
        const ids = await ensureRuntimeSession(payload.sessionId);
        const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);

        const metadata: TerminalCommandMetadata = {
            ...provenEvidence("Observed directly by the Codex PostToolUse/Bash hook."),
            ...buildSemanticMetadata(semantic),
            command,
            commandAnalysis: analysis,
            ...(description ? {description} : {}),
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.terminalCommand,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane,
            title: description || command.slice(0, 80),
            body: description ? `${description}\n\n$ ${command}` : command,
            metadata,
        });
    },
});
