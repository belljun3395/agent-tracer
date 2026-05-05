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
 *
 * Blocking: Yes (decision: "block" replaces tool result; does not undo it).
 * This handler never blocks.
 *
 * Privacy contract: tool_response is intentionally NOT captured. Only the
 * agent's action (command, description, target paths) is recorded.
 */
import {toTrimmedString} from "~codex/util/utils.js";

function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexPostToolUse} from "~shared/hooks/codex/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
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

await runHook("PostToolUse/Bash", {
    logger: codexHookRuntime.logger,
    parse: readCodexPostToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const command = toTrimmedString(payload.toolInput["command"]);
        if (!command) return;

        const description = toTrimmedString(payload.toolInput["description"]);
        const timeoutMs = toOptionalNumber(payload.toolInput["timeout"]);
        const runInBackground = toBoolean(payload.toolInput["run_in_background"]);
        const ids = await ensureRuntimeSession(payload.sessionId);
        const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);
        const filePaths = collectFileTargets(analysis);

        const metadata: TerminalCommandMetadata = {
            ...provenEvidence("Observed directly by the Codex PostToolUse/Bash hook."),
            ...buildSemanticMetadata(semantic),
            command,
            commandAnalysis: analysis,
            ...(description ? {description} : {}),
            ...(timeoutMs !== undefined ? {timeoutMs} : {}),
            ...(runInBackground ? {runInBackground: true} : {}),
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.terminalCommand,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane,
            title: description || command.slice(0, 80),
            body: description ? `${description}\n\n$ ${command}` : command,
            ...(filePaths.length > 0 ? {filePaths} : {}),
            metadata,
        });
    },
});
