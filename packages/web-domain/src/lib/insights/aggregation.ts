import type { TimelineEvent } from "../../types.js";
import { resolveEventSubtype } from "../eventSubtype.js";
import type {
    CompactInsight,
    CompactRelation,
    ExplorationInsight,
    ExploredFileStat,
    FileActivityStat,
    ObservabilityStats,
    SubagentInsight,
    TokenSummary,
    WebLookupStat
} from "./types.js";
import {
    extractMetadataBoolean,
    extractMetadataNumber,
    extractMetadataString,
    extractMetadataStringArray,
    isCompactEvent
} from "./helpers.js";

/**
 * Event kinds that route to the "exploration" lane but are NOT real exploration
 * tool usage — e.g., transcript attachments (deferred tools, MCP instructions,
 * skill listings, nested memory). These pollute exploration aggregations.
 */
const NON_EXPLORATION_TOOL_KINDS: ReadonlySet<TimelineEvent["kind"]> = new Set([
    "instructions.loaded",
    "user.message"
]);

function isExplorationToolEvent(event: TimelineEvent): boolean {
    if (event.lane !== "exploration") {
        return false;
    }
    return !NON_EXPLORATION_TOOL_KINDS.has(event.kind);
}

export function buildObservabilityStats(timeline: readonly TimelineEvent[], exploredFiles: number, compactOccurrences = 0): ObservabilityStats {
    let actions = 0;
    let coordinationActivities = 0;
    let checks = 0;
    let violations = 0;
    let passes = 0;
    for (const event of timeline) {
        if (event.kind === "action.logged") {
            actions += 1;
        }
        if (event.kind === "agent.activity.logged") {
            coordinationActivities += 1;
        }
        if (event.kind === "verification.logged") {
            checks += 1;
            const verificationStatus = extractMetadataString(event.metadata, "verificationStatus");
            if (verificationStatus === "pass")
                passes += 1;
            if (verificationStatus === "fail")
                violations += 1;
        }
        if (event.kind === "rule.logged") {
            const ruleStatus = extractMetadataString(event.metadata, "ruleStatus");
            if (ruleStatus === "check")
                checks += 1;
            if (ruleStatus === "violation")
                violations += 1;
            if (ruleStatus === "pass" || ruleStatus === "fix-applied")
                passes += 1;
        }
    }
    return {
        actions,
        coordinationActivities,
        exploredFiles,
        checks,
        violations,
        passes,
        compactions: compactOccurrences
    };
}
export function extractCompactTimestamps(timeline: readonly TimelineEvent[]): readonly string[] {
    const timestamps: string[] = [];
    for (const event of timeline) {
        const isCompact = event.classification.tags.includes("compact")
            || extractMetadataBoolean(event.metadata, "compactEvent")
            || Boolean(extractMetadataString(event.metadata, "compactPhase"))
            || Boolean(extractMetadataString(event.metadata, "compactEventType"));
        if (!isCompact) {
            continue;
        }
        const phase = extractMetadataString(event.metadata, "compactPhase");
        if (phase === "after" || !phase) {
            timestamps.push(event.createdAt);
        }
    }
    return timestamps.sort((a, b) => Date.parse(a) - Date.parse(b));
}
function deriveCompactRelation(readTimestamps: readonly string[], lastCompactAt: string | undefined): CompactRelation {
    if (!lastCompactAt) {
        return "no-compact";
    }
    const compactMs = Date.parse(lastCompactAt);
    const beforeCount = readTimestamps.filter((t) => Date.parse(t) < compactMs).length;
    const afterCount = readTimestamps.filter((t) => Date.parse(t) >= compactMs).length;
    if (beforeCount > 0 && afterCount > 0) {
        return "across-compact";
    }
    if (afterCount > 0) {
        return "after-compact";
    }
    return "before-compact";
}
export function collectExploredFiles(timeline: readonly TimelineEvent[]): readonly ExploredFileStat[] {
    const compactTimestamps = extractCompactTimestamps(timeline);
    const lastCompactAt = compactTimestamps.at(-1);
    const fileTimestamps = new Map<string, string[]>();
    for (const event of timeline) {
        // Only count real exploration tool usage (reads, greps, etc.) or file.changed
        // events within the exploration lane. Exclude transcript-attachment kinds
        // (instructions.loaded) and regex-extracted user.message filePaths so the
        // number is coherent with the evidence surfaces that render it.
        if (!isExplorationToolEvent(event)) {
            continue;
        }
        if (event.kind === "file.changed" && extractMetadataStringArray(event.metadata, "filePaths").length === 0) {
            continue;
        }
        for (const filePath of extractMetadataStringArray(event.metadata, "filePaths")) {
            const existing = fileTimestamps.get(filePath);
            if (existing) {
                existing.push(event.createdAt);
            }
            else {
                fileTimestamps.set(filePath, [event.createdAt]);
            }
        }
    }
    const stats: ExploredFileStat[] = [];
    for (const [filePath, timestamps] of fileTimestamps) {
        const sorted = [...timestamps].sort((a, b) => Date.parse(a) - Date.parse(b));
        const firstSeenAt = sorted[0]!;
        const lastSeenAt = sorted[sorted.length - 1]!;
        stats.push({
            path: filePath,
            count: sorted.length,
            firstSeenAt,
            lastSeenAt,
            readTimestamps: sorted,
            compactRelation: deriveCompactRelation(sorted, lastCompactAt)
        });
    }
    return stats.sort((left, right) => {
        const timeDelta = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
        if (timeDelta !== 0) {
            return timeDelta;
        }
        if (right.count !== left.count) {
            return right.count - left.count;
        }
        return left.path.localeCompare(right.path);
    });
}
export function collectWebLookups(timeline: readonly TimelineEvent[]): readonly WebLookupStat[] {
    const compactTimestamps = extractCompactTimestamps(timeline);
    const lastCompactAt = compactTimestamps.at(-1);
    const urlData = new Map<string, {
        toolName: string;
        timestamps: string[];
    }>();
    for (const event of timeline) {
        if (event.lane !== "exploration")
            continue;
        const urls = extractMetadataStringArray(event.metadata, "webUrls");
        if (urls.length === 0)
            continue;
        const toolName = extractMetadataString(event.metadata, "toolName") ?? "WebSearch";
        for (const url of urls) {
            const existing = urlData.get(url);
            if (existing) {
                existing.timestamps.push(event.createdAt);
            }
            else {
                urlData.set(url, { toolName, timestamps: [event.createdAt] });
            }
        }
    }
    const stats: WebLookupStat[] = [];
    for (const [url, { toolName, timestamps }] of urlData) {
        const sorted = [...timestamps].sort((a, b) => Date.parse(a) - Date.parse(b));
        stats.push({
            url,
            toolName,
            count: sorted.length,
            firstSeenAt: sorted[0]!,
            lastSeenAt: sorted[sorted.length - 1]!,
            compactRelation: deriveCompactRelation(sorted, lastCompactAt)
        });
    }
    return stats.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
}
export function collectFileActivity(timeline: readonly TimelineEvent[]): readonly FileActivityStat[] {
    const compactTimestamps = extractCompactTimestamps(timeline);
    const lastCompactAt = compactTimestamps.at(-1);
    const fileData = new Map<string, {
        reads: string[];
        writes: string[];
    }>();
    for (const event of timeline) {
        const isExploration = event.lane === "exploration";
        const isImplementation = event.lane === "implementation";
        if (!isExploration && !isImplementation)
            continue;
        if (event.kind === "file.changed" && extractMetadataStringArray(event.metadata, "filePaths").length === 0) {
            continue;
        }
        for (const filePath of extractMetadataStringArray(event.metadata, "filePaths")) {
            const existing = fileData.get(filePath) ?? { reads: [], writes: [] };
            if (isExploration) {
                existing.reads.push(event.createdAt);
            }
            else {
                existing.writes.push(event.createdAt);
            }
            fileData.set(filePath, existing);
        }
    }
    const stats: FileActivityStat[] = [];
    for (const [filePath, data] of fileData) {
        const allTimestamps = [...data.reads, ...data.writes].sort((a, b) => Date.parse(a) - Date.parse(b));
        if (allTimestamps.length === 0)
            continue;
        stats.push({
            path: filePath,
            readCount: data.reads.length,
            writeCount: data.writes.length,
            firstSeenAt: allTimestamps[0]!,
            lastSeenAt: allTimestamps[allTimestamps.length - 1]!,
            compactRelation: deriveCompactRelation(allTimestamps, lastCompactAt)
        });
    }
    return stats.sort((left, right) => {
        const timeDelta = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
        if (timeDelta !== 0)
            return timeDelta;
        const totalRight = right.readCount + right.writeCount;
        const totalLeft = left.readCount + left.writeCount;
        if (totalRight !== totalLeft)
            return totalRight - totalLeft;
        return left.path.localeCompare(right.path);
    });
}
export function buildExplorationInsight(timeline: readonly TimelineEvent[], exploredFiles: readonly ExploredFileStat[], webLookups: readonly WebLookupStat[]): ExplorationInsight {
    const toolBreakdown: Record<string, number> = {};
    let totalExplorations = 0;
    let firstExplorationAt: string | undefined;
    let lastExplorationAt: string | undefined;
    for (const event of timeline) {
        // Skip anything that routes to exploration but isn't real tool usage —
        // transcript-attachment deltas (instructions.loaded) and user-message
        // regex mentions pollute the breakdown and must not be counted here.
        if (!isExplorationToolEvent(event))
            continue;
        if (event.kind === "file.changed")
            continue;
        totalExplorations += 1;
        const subtype = resolveEventSubtype(event);
        const breakdownKey = subtype?.label ?? extractMetadataString(event.metadata, "toolName") ?? event.kind;
        toolBreakdown[breakdownKey] = (toolBreakdown[breakdownKey] ?? 0) + 1;
        if (!firstExplorationAt || Date.parse(event.createdAt) < Date.parse(firstExplorationAt)) {
            firstExplorationAt = event.createdAt;
        }
        if (!lastExplorationAt || Date.parse(event.createdAt) > Date.parse(lastExplorationAt)) {
            lastExplorationAt = event.createdAt;
        }
    }
    let preCompactFiles = 0;
    let postCompactFiles = 0;
    let acrossCompactFiles = 0;
    let preCompactWebLookups = 0;
    let postCompactWebLookups = 0;
    let acrossCompactWebLookups = 0;
    for (const file of exploredFiles) {
        switch (file.compactRelation) {
            case "before-compact":
                preCompactFiles += 1;
                break;
            case "after-compact":
                postCompactFiles += 1;
                break;
            case "across-compact":
                acrossCompactFiles += 1;
                break;
        }
    }
    for (const lookup of webLookups) {
        switch (lookup.compactRelation) {
            case "before-compact":
                preCompactWebLookups += 1;
                break;
            case "after-compact":
                postCompactWebLookups += 1;
                break;
            case "across-compact":
                acrossCompactWebLookups += 1;
                break;
        }
    }
    return {
        totalExplorations,
        uniqueFiles: exploredFiles.length,
        uniqueWebLookups: webLookups.length,
        toolBreakdown,
        preCompactFiles,
        postCompactFiles,
        acrossCompactFiles,
        preCompactWebLookups,
        postCompactWebLookups,
        acrossCompactWebLookups,
        firstExplorationAt,
        lastExplorationAt
    };
}
export function buildCompactInsight(timeline: readonly TimelineEvent[]): CompactInsight {
    let handoffCount = 0;
    let eventCount = 0;
    let beforeCount = 0;
    let afterCount = 0;
    let fallbackCount = 0;
    let lastSeenAt: string | undefined;
    let latestTitle: string | undefined;
    let latestBody: string | undefined;
    const tagFacets = new Set<string>();
    for (const event of timeline) {
        if (!isCompactEvent(event)) {
            continue;
        }
        fallbackCount += 1;
        const compactPhase = extractMetadataString(event.metadata, "compactPhase");
        if (compactPhase === "handoff") {
            handoffCount += 1;
        }
        if (compactPhase === "event") {
            eventCount += 1;
        }
        if (compactPhase === "before") {
            beforeCount += 1;
        }
        if (compactPhase === "after") {
            afterCount += 1;
        }
        if (!lastSeenAt || Date.parse(event.createdAt) >= Date.parse(lastSeenAt)) {
            lastSeenAt = event.createdAt;
            latestTitle = event.title;
            latestBody = event.body;
        }
        for (const tag of event.classification.tags) {
            if (tag.startsWith("compact:")) {
                tagFacets.add(tag);
            }
        }
    }
    return {
        occurrences: eventCount > 0 ? eventCount : fallbackCount,
        handoffCount,
        eventCount,
        beforeCount,
        afterCount,
        lastSeenAt,
        latestTitle,
        latestBody,
        tagFacets: [...tagFacets].sort()
    };
}
export function buildSubagentInsight(timeline: readonly TimelineEvent[]): SubagentInsight {
    let delegations = 0;
    let backgroundTransitions = 0;
    let linkedBackgroundEvents = 0;
    const taskStates = new Map<string, {
        completed: boolean;
    }>();
    for (const event of timeline) {
        const activityType = extractMetadataString(event.metadata, "activityType");
        if (event.kind === "agent.activity.logged" && activityType === "delegation") {
            delegations += 1;
        }
        const asyncTaskId = extractMetadataString(event.metadata, "asyncTaskId");
        if (event.lane === "background" || asyncTaskId) {
            backgroundTransitions += 1;
            if (asyncTaskId
                || extractMetadataString(event.metadata, "parentTaskId")
                || extractMetadataString(event.metadata, "parentSessionId")
                || extractMetadataString(event.metadata, "backgroundTaskId")) {
                linkedBackgroundEvents += 1;
            }
        }
        if (!asyncTaskId) {
            continue;
        }
        const existing = taskStates.get(asyncTaskId) ?? { completed: false };
        const asyncStatus = extractMetadataString(event.metadata, "asyncStatus");
        const completed = existing.completed
            || asyncStatus === "completed"
            || asyncStatus === "error"
            || asyncStatus === "cancelled"
            || asyncStatus === "interrupt";
        taskStates.set(asyncTaskId, { completed });
    }
    const completedAsyncTasks = [...taskStates.values()].filter((task) => task.completed).length;
    const uniqueAsyncTasks = taskStates.size;
    return {
        delegations,
        backgroundTransitions,
        linkedBackgroundEvents,
        uniqueAsyncTasks,
        completedAsyncTasks,
        unresolvedAsyncTasks: Math.max(0, uniqueAsyncTasks - completedAsyncTasks)
    };
}

/**
 * Canonical unique-file count.
 *
 * Routes through {@link collectExploredFiles} so that every surface that shows
 * a "Unique Files" number pulls from the same strict source (file.changed +
 * tool.used file-touching in the exploration lane), rather than regex-extracted
 * user.message filePaths or transcript attachments. Use this in place of any
 * ad-hoc `filePaths`-sum to keep Overview and Exploration numbers consistent.
 */
export function countUniqueExploredFiles(timeline: readonly TimelineEvent[]): number {
    return collectExploredFiles(timeline).length;
}

/**
 * Aggregates assistant.response token usage across the whole task timeline.
 *
 * The Anthropic usage payload reports `input_tokens` as the *new* (uncached)
 * input tokens, separate from cache-read and cache-create. This helper sums
 * each channel independently so Overview surfaces can show a coherent
 * single-number cache hit rate across the entire task rather than a misleading
 * per-turn rate (early turns have no cache to hit).
 */
export function getTokenSummary(timeline: readonly TimelineEvent[]): TokenSummary {
    let totalNewInput = 0;
    let totalCacheRead = 0;
    let totalCacheCreate = 0;
    let totalOutput = 0;
    let turnCount = 0;
    for (const event of timeline) {
        if (event.kind !== "assistant.response") {
            continue;
        }
        const inputTokens = extractMetadataNumber(event.metadata, "inputTokens") ?? 0;
        const cacheReadTokens = extractMetadataNumber(event.metadata, "cacheReadTokens") ?? 0;
        const cacheCreateTokens = extractMetadataNumber(event.metadata, "cacheCreateTokens") ?? 0;
        const outputTokens = extractMetadataNumber(event.metadata, "outputTokens") ?? 0;
        // Guard against negative values from corrupt metadata.
        totalNewInput += Math.max(0, inputTokens);
        totalCacheRead += Math.max(0, cacheReadTokens);
        totalCacheCreate += Math.max(0, cacheCreateTokens);
        totalOutput += Math.max(0, outputTokens);
        turnCount += 1;
    }
    const totalInputSide = totalNewInput + totalCacheRead + totalCacheCreate;
    const overallHitRate = totalInputSide > 0
        ? (totalCacheRead / totalInputSide) * 100
        : 0;
    return {
        totalNewInput,
        totalCacheRead,
        totalCacheCreate,
        totalOutput,
        overallHitRate,
        turnCount
    };
}
