import {
    isExplorationLane,
    isUserMessageEvent,
} from "./event.predicates.js";
import { META } from "~domain/runtime/const/metadata.keys.const.js";
import { readStringArray } from "./event.metadata.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";
import {
    filePathsInDirectory,
    isDirectoryPath,
    matchFilePaths,
    normalizeFilePath,
} from "~domain/shared/paths.js";
import { NON_EXPLORATION_TOOL_KINDS } from "./const/file.verification.const.js";
import type { MentionedFileVerification } from "./model/file.verification.model.js";


const COMMAND_EXPLORATION_OPERATIONS = new Set([
    "read_file",
    "read_range",
    "search",
    "inspect_diff",
    "inspect_status",
    "inspect_history",
    "list",
    "limit_output",
]);

interface ExploredFileStat {
    readonly path: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly readTimestamps: readonly string[];
}

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

export function analyzeMentionedFileVerifications(
    timeline: readonly TimelineEvent[],
    workspacePath?: string,
): readonly MentionedFileVerification[] {
    const exploredFiles = collectExploredFiles(timeline);
    const exploredMap = new Map(exploredFiles.map((file) => [file.path, file]));
    const allExploredPaths = exploredFiles.map((file) => file.path);
    const results: MentionedFileVerification[] = [];
    const seen = new Set<string>();

    for (const event of timeline) {
        if (!isUserMessageEvent(event)) {
            continue;
        }
        const mentionedPaths = readStringArray(event.metadata, META.filePaths);
        const mentionedMs = Date.parse(event.createdAt);

        for (const mentionedPath of mentionedPaths) {
            const normalizedMentionedPath = normalizeFilePath(mentionedPath);
            if (seen.has(normalizedMentionedPath)) {
                continue;
            }
            seen.add(normalizedMentionedPath);

            if (isDirectoryPath(normalizedMentionedPath)) {
                const matchedPaths = filePathsInDirectory(normalizedMentionedPath, allExploredPaths, workspacePath);
                const exploredFilesInFolder = matchedPaths
                    .map((path) => exploredMap.get(path))
                    .filter((file): file is ExploredFileStat => file !== undefined)
                    .map((file) => ({
                        path: file.path,
                        count: file.count,
                        firstSeenAt: file.firstSeenAt,
                        lastSeenAt: file.lastSeenAt,
                    }));

                results.push({
                    mentionType: "directory",
                    path: normalizedMentionedPath,
                    mentionedAt: event.createdAt,
                    mentionedInEventId: event.id,
                    exploredFilesInFolder,
                    wasExplored: exploredFilesInFolder.length > 0,
                    exploredAfterMention: exploredFilesInFolder.some(
                        (file: { readonly lastSeenAt: string }) => Date.parse(file.lastSeenAt) > mentionedMs,
                    ),
                });
                continue;
            }

            const matchedStat = findMatchingExploredFile(normalizedMentionedPath, exploredMap, workspacePath);
            results.push({
                mentionType: "file",
                path: normalizedMentionedPath,
                mentionedAt: event.createdAt,
                mentionedInEventId: event.id,
                wasExplored: Boolean(matchedStat),
                ...(matchedStat ? {firstExploredAt: matchedStat.firstSeenAt} : {}),
                explorationCount: matchedStat?.count ?? 0,
                exploredAfterMention: Boolean(
                    matchedStat?.readTimestamps.some((timestamp: string) => Date.parse(timestamp) > mentionedMs),
                ),
            });
        }
    }

    return results.sort((left, right) => Date.parse(left.mentionedAt) - Date.parse(right.mentionedAt));
}

function collectExploredFiles(timeline: readonly TimelineEvent[]): readonly ExploredFileStat[] {
    const fileTimestamps = new Map<string, string[]>();
    for (const event of timeline) {
        if (isExplorationToolEvent(event)) {
            for (const filePath of readStringArray(event.metadata, META.filePaths)) {
                addExploredPath(fileTimestamps, filePath, event.createdAt);
            }
        }
        for (const filePath of extractCommandExplorationPaths(event)) {
            addExploredPath(fileTimestamps, filePath, event.createdAt);
        }
    }

    return [...fileTimestamps.entries()].map(([path, timestamps]: [string, string[]]) => {
        const sorted = [...timestamps].sort((left, right) => Date.parse(left) - Date.parse(right));
        return {
            path,
            count: sorted.length,
            firstSeenAt: sorted[0] ?? "",
            lastSeenAt: sorted[sorted.length - 1] ?? "",
            readTimestamps: sorted,
        };
    }).sort((left, right) => {
        const timeDelta = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
        if (timeDelta !== 0) return timeDelta;
        if (right.count !== left.count) return right.count - left.count;
        return left.path.localeCompare(right.path);
    });
}

function addExploredPath(fileTimestamps: Map<string, string[]>, filePath: string, timestamp: string): void {
    const normalized = normalizeFilePath(filePath);
    const existing = fileTimestamps.get(normalized);
    if (existing) {
        existing.push(timestamp);
    } else {
        fileTimestamps.set(normalized, [timestamp]);
    }
}

function isExplorationToolEvent(event: TimelineEvent): boolean {
    return isExplorationLane(event.lane) && !NON_EXPLORATION_TOOL_KINDS.has(event.kind);
}

function extractCommandExplorationPaths(event: TimelineEvent): readonly string[] {
    const analysis = event.metadata["commandAnalysis"];
    if (!analysis || typeof analysis !== "object") return [];
    const steps = (analysis as { readonly steps?: unknown }).steps;
    if (!Array.isArray(steps)) return [];

    const paths: string[] = [];
    for (const step of flattenCommandSteps(steps)) {
        const operation = typeof step.operation === "string" ? step.operation : "unknown";
        const effect = typeof step.effect === "string" ? step.effect : "unknown";
        if (operation === "pipeline") continue;
        if (!COMMAND_EXPLORATION_OPERATIONS.has(operation) && effect !== "read_only") continue;
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
    return [...new Set(paths)];
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

function findMatchingExploredFile(
    mentionedPath: string,
    exploredMap: Map<string, ExploredFileStat>,
    workspacePath?: string,
): ExploredFileStat | undefined {
    const exact = exploredMap.get(mentionedPath);
    if (exact) return exact;
    for (const [exploredPath, stat] of exploredMap.entries()) {
        if (matchFilePaths(mentionedPath, exploredPath, workspacePath)) return stat;
    }
    return undefined;
}
