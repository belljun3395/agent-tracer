import { normalizeFilePath } from "@monitor/timeline-api/event/domain/paths.js";
import { isUserMessageEvent } from "./event.predicates.policy.js";
import { commandTargetPath, flattenCommandSteps } from "./command.analysis.policy.js";
import { META } from "@monitor/timeline-api/event/domain/runtime/const/metadata.keys.const.js";
import { readStringArray } from "./event.metadata.policy.js";
import type { TimelineEvent } from "./type/timeline.event.type.js";
import type { TimelineEventPaths } from "./type/timeline.event.paths.type.js";

const COMMAND_PATH_OPERATIONS = new Set([
    "read_file",
    "read_range",
    "search",
    "inspect_diff",
    "inspect_status",
    "inspect_history",
    "list",
    "limit_output",
]);

export function resolveTimelineEventPaths(event: TimelineEvent): TimelineEventPaths {
    const filePaths = uniquePaths([
        ...readStringArray(event.metadata, META.filePaths),
        ...extractCommandAnalysisFilePaths(event),
    ].map((filePath) => normalizeFilePath(filePath)));
    const primaryPath = filePaths[0];
    return {
        ...(primaryPath ? { primaryPath } : {}),
        filePaths,
        mentionedPaths: isUserMessageEvent(event) ? filePaths : [],
    };
}

function extractCommandAnalysisFilePaths(event: TimelineEvent): readonly string[] {
    const analysis = event.metadata["commandAnalysis"];
    if (!analysis || typeof analysis !== "object") return [];
    const steps = (analysis as { readonly steps?: unknown }).steps;
    if (!Array.isArray(steps)) return [];

    const paths: string[] = [];
    for (const step of flattenCommandSteps(steps)) {
        const operation = typeof step.operation === "string" ? step.operation : "unknown";
        const effect = typeof step.effect === "string" ? step.effect : "unknown";
        if (operation === "pipeline") continue;
        if (!COMMAND_PATH_OPERATIONS.has(operation) && effect !== "read_only") continue;
        const targets = Array.isArray(step.targets) ? step.targets : [];
        for (const targetValue of targets) {
            if (!targetValue || typeof targetValue !== "object") continue;
            const path = commandTargetPath(targetValue);
            if (path) paths.push(path);
        }
    }
    return paths;
}

function uniquePaths(paths: readonly string[]): readonly string[] {
    return [...new Set(paths.filter((path) => path.length > 0))];
}
