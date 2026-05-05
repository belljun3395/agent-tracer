/**
 * Claude Code Hook: PostToolUse — matcher: "Monitor"
 * Ref: https://code.claude.com/docs/en/tools-reference#monitor-tool
 *
 * Monitor tool runs a script in the background and feeds each output line
 * back to Claude as it arrives. Long-running by nature — emits a dedicated
 * `monitor.observed` event KIND so the dashboard can surface it as a
 * standing watch rather than a one-shot tool call.
 *
 * Tool input fields:
 *   command       string  — shell script to run
 *   description   string?
 *   filter        string? — line filter regex
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { MonitorMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("Monitor", async ({payload, ids}) => {
    const script = toTrimmedString(payload.toolInput["command"]);
    const description = toTrimmedString(payload.toolInput["description"]);
    const title = description || `Monitor: ${script.slice(0, 60)}`;
    const body = description ? `${description}\n\n$ ${script}` : script;

    const metadata: MonitorMetadata = {
        ...provenEvidence("Observed directly by the Monitor PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "shell_probe",
            subtypeLabel: "Monitor watch",
            subtypeGroup: "shell",
            toolFamily: "terminal",
            operation: "monitor",
            entityType: "command",
            entityName: script.split(/\s+/)[0] || "monitor",
            sourceTool: "Monitor",
        }),
        toolName: "Monitor",
        ...(script ? {monitorScript: script} : {}),
        ...(description ? {monitorDescription: description} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.monitorObserved,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.background,
        title,
        body,
        metadata,
    });
});
