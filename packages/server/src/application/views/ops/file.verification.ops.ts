import {
    isExplorationLane,
    isUserMessageEvent,
    META,
    readStringArray,
    type TimelineEvent,
} from "~domain/index.js";
import {
    filePathsInDirectory,
    isDirectoryPath,
    matchFilePaths,
    normalizeFilePath,
} from "~domain/paths.utils.js";
import { NON_EXPLORATION_TOOL_KINDS } from "../file.verification.const.js";
import type { MentionedFileVerification } from "../file.verification.type.js";

export type * from "../file.verification.type.js";

interface ExploredFileStat {
    readonly path: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly readTimestamps: readonly string[];
}

export function buildMentionedFileVerifications(
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
                ...(matchedStat ? { firstExploredAt: matchedStat.firstSeenAt } : {}),
                explorationCount: matchedStat?.count ?? 0,
                exploredAfterMention: Boolean(
                    matchedStat?.readTimestamps.some((timestamp: string) => Date.parse(timestamp) > mentionedMs),
                ),
            });
        }
    }

    return results.sort((left, right) => Date.parse(left.mentionedAt) - Date.parse(right.mentionedAt));
}

export function collectExploredFiles(timeline: readonly TimelineEvent[]): readonly ExploredFileStat[] {
    const fileTimestamps = new Map<string, string[]>();
    for (const event of timeline) {
        if (!isExplorationToolEvent(event)) {
            continue;
        }
        for (const filePath of readStringArray(event.metadata, META.filePaths)) {
            const normalized = normalizeFilePath(filePath);
            const existing = fileTimestamps.get(normalized);
            if (existing) {
                existing.push(event.createdAt);
            } else {
                fileTimestamps.set(normalized, [event.createdAt]);
            }
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

function isExplorationToolEvent(event: TimelineEvent): boolean {
    return isExplorationLane(event.lane) && !NON_EXPLORATION_TOOL_KINDS.has(event.kind);
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
