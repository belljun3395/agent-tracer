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
 * and attaches the runtime-derived lane + semantic metadata, plus any file
 * path targets surfaced by command-analysis (so `cat foo.ts` shows up in the
 * filePaths array just like a Read event).
 *
 * Privacy contract: tool_response is intentionally NOT captured. Only the
 * agent's action (command, description, target paths) is recorded.
 */
import {toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import type { TerminalCommandMetadata } from "~shared/events/metadata.type.js";
import type { CommandAnalysis, CommandStep } from "~shared/semantics/command-analysis.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferCommandSemantic } from "~shared/semantics/inference.command.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

function toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

function collectFileTargets(analysis: CommandAnalysis): string[] {
    const seen = new Set<string>();
    const filePaths: string[] = [];
    const visit = (step: CommandStep): void => {
        for (const target of step.targets) {
            if (target.type !== "file" && target.type !== "path") continue;
            if (!target.value || target.value === "-" || seen.has(target.value)) continue;
            seen.add(target.value);
            filePaths.push(target.value);
        }
        if (step.pipeline) for (const sub of step.pipeline) visit(sub);
    };
    for (const step of analysis.steps) visit(step);
    return filePaths;
}

await runPostToolUseHook("Bash", async ({payload, ids}) => {
    const command = toTrimmedString(payload.toolInput["command"]);
    if (!command) return;

    const description = toTrimmedString(payload.toolInput["description"]);
    const timeoutMs = toOptionalNumber(payload.toolInput["timeout"]);
    const runInBackground = toBoolean(payload.toolInput["run_in_background"]);
    const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);
    const filePaths = collectFileTargets(analysis);

    const metadata: TerminalCommandMetadata = {
        ...provenEvidence("Observed directly by the Bash PostToolUse hook."),
        ...buildSemanticMetadata(semantic),
        command,
        commandAnalysis: analysis,
        ...(description ? {description} : {}),
        ...(timeoutMs !== undefined ? {timeoutMs} : {}),
        ...(runInBackground ? {runInBackground: true} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.terminalCommand,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane,
        title: description || command.slice(0, 80),
        body: description ? `${description}\n\n$ ${command}` : command,
        ...(filePaths.length > 0 ? {filePaths} : {}),
        metadata,
    });
});
