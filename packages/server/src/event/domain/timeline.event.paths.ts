import { normalizeFilePath } from "~event/domain/paths.js";
import { isUserMessageEvent } from "./event.predicates.js";
import { META } from "~event/domain/runtime/const/metadata.keys.const.js";
import { readStringArray } from "./event.metadata.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";
import type { TimelineEventPaths } from "./model/timeline.event.paths.model.js";

interface CommandTargetLike {
    readonly type?: unknown;
    readonly value?: unknown;
}

interface CommandStepLike {
    readonly operation?: unknown;
    readonly effect?: unknown;
    readonly targets?: unknown;
    readonly pipeline?: unknown;
}

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
            const target = targetValue as CommandTargetLike;
            if (target.type !== "file" && target.type !== "directory" && target.type !== "path") continue;
            if (typeof target.value === "string" && target.value.length > 0) {
                paths.push(target.value);
            }
        }
    }
    return paths;
}

function flattenCommandSteps(values: readonly unknown[]): readonly CommandStepLike[] {
    const flattened: CommandStepLike[] = [];
    for (const value of values) {
        if (!value || typeof value !== "object") continue;
        const step = value as CommandStepLike;
        flattened.push(step);
        if (Array.isArray(step.pipeline)) {
            flattened.push(...flattenCommandSteps(step.pipeline));
        }
    }
    return flattened;
}

function uniquePaths(paths: readonly string[]): readonly string[] {
    return [...new Set(paths.filter((path) => path.length > 0))];
}
