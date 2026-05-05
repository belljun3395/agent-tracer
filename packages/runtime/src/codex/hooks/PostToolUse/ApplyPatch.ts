/**
 * Codex Hook: PostToolUse — matcher: "apply_patch" (alias: Edit, Write)
 *
 * Ref: https://developers.openai.com/codex/hooks#posttooluse
 *
 * Codex's apply_patch carries an `input` field with a multi-file diff in the
 * canonical "*** Update File: <path>" / "*** Add File:" / "*** Delete File:"
 * format. We extract the touched file paths and emit one tool.used event
 * per patch (not per file — one patch is one logical change).
 *
 * Marked `crossCheck.source = "hook"`; the rollout observer emits the same
 * logical event with `source = "rollout"`. Server dedupes on
 * (kind, sessionId, dedupeKey).
 */
import * as path from "node:path";
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {toTrimmedString} from "~codex/util/utils.js";
import {readCodexPostToolUse} from "~shared/hooks/codex/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferFileToolSemantic } from "~shared/semantics/inference.file.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

const PATCH_HEADER = /^\*\*\* (?:Add File|Update File|Delete File|Move to):\s+(.+?)\s*$/;

function extractPatchFilePaths(input: string): string[] {
    const seen = new Set<string>();
    const filePaths: string[] = [];
    for (const line of input.split(/\r?\n/)) {
        const match = line.match(PATCH_HEADER);
        const filePath = match?.[1]?.trim();
        if (!filePath || seen.has(filePath)) continue;
        seen.add(filePath);
        filePaths.push(filePath);
    }
    return filePaths;
}

await runHook("PostToolUse/ApplyPatch", {
    logger: codexHookRuntime.logger,
    parse: readCodexPostToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const patchInput = toTrimmedString(payload.toolInput["input"])
            || toTrimmedString(payload.toolInput["patch"]);
        if (!patchInput) return;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const filePaths = extractPatchFilePaths(patchInput);
        const primaryPath = filePaths[0] ?? "";
        const semantic = inferFileToolSemantic("apply_patch", primaryPath || undefined);
        const dedupeKey = payload.toolUseId
            || `apply_patch:${primaryPath}:${patchInput.length}`;

        const metadata: ToolUsedMetadata = {
            ...provenEvidence("Observed directly by the Codex PostToolUse/ApplyPatch hook."),
            ...buildSemanticMetadata(semantic),
            toolName: "apply_patch",
            ...(primaryPath ? {filePath: primaryPath, relPath: primaryPath} : {}),
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
            crossCheck: {source: "hook", dedupeKey},
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.toolUsed,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.implementation,
            title: primaryPath ? `Apply patch: ${path.basename(primaryPath)}` : "Apply patch",
            body: filePaths.length > 0
                ? `Patched ${filePaths.length} file(s): ${filePaths.slice(0, 3).join(", ")}${filePaths.length > 3 ? "…" : ""}`
                : "Codex applied a patch.",
            ...(filePaths.length > 0 ? {filePaths} : {}),
            metadata,
        });
    },
});
