import { buildReusableTaskSnapshot, filePathsInDirectory, isDirectoryPath, matchFilePaths } from "@monitor/core";
import type { ReusableTaskSnapshot } from "@monitor/core";
import type { MonitoringTask, TimelineEvent, TimelineLane } from "../types.js";
import { resolveEventSubtype } from "./eventSubtype.js";
export interface ObservabilityStats {
    readonly actions: number;
    readonly coordinationActivities: number;
    readonly exploredFiles: number;
    readonly checks: number;
    readonly violations: number;
    readonly passes: number;
    readonly compactions: number;
}
export interface ExploredFileStat {
    readonly path: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly readTimestamps: readonly string[];
    readonly compactRelation: CompactRelation;
}
export interface WebLookupStat {
    readonly url: string;
    readonly toolName: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly compactRelation: CompactRelation;
}
export type CompactRelation = "before-compact" | "after-compact" | "across-compact" | "no-compact";
export interface FileActivityStat {
    readonly path: string;
    readonly readCount: number;
    readonly writeCount: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly compactRelation: CompactRelation;
}
export interface ExplorationInsight {
    readonly totalExplorations: number;
    readonly uniqueFiles: number;
    readonly uniqueWebLookups: number;
    readonly toolBreakdown: Readonly<Record<string, number>>;
    readonly preCompactFiles: number;
    readonly postCompactFiles: number;
    readonly acrossCompactFiles: number;
    readonly preCompactWebLookups: number;
    readonly postCompactWebLookups: number;
    readonly acrossCompactWebLookups: number;
    readonly firstExplorationAt?: string | undefined;
    readonly lastExplorationAt?: string | undefined;
}
export interface SubagentInsight {
    readonly delegations: number;
    readonly backgroundTransitions: number;
    readonly linkedBackgroundEvents: number;
    readonly uniqueAsyncTasks: number;
    readonly completedAsyncTasks: number;
    readonly unresolvedAsyncTasks: number;
}
export interface CompactInsight {
    readonly occurrences: number;
    readonly handoffCount: number;
    readonly eventCount: number;
    readonly beforeCount: number;
    readonly afterCount: number;
    readonly lastSeenAt?: string | undefined;
    readonly latestTitle?: string | undefined;
    readonly latestBody?: string | undefined;
    readonly tagFacets: readonly string[];
}
export interface RuleCoverageStat {
    readonly ruleId: string;
    readonly title: string;
    readonly configured: boolean;
    readonly lane?: TimelineLane | undefined;
    readonly tags: readonly string[];
    readonly matchCount: number;
    readonly ruleEventCount: number;
    readonly checkCount: number;
    readonly violationCount: number;
    readonly passCount: number;
    readonly warningCount: number;
    readonly blockedCount: number;
    readonly approvalRequestCount: number;
    readonly lastSeenAt?: string | undefined;
}
export interface RuleDecisionStat {
    readonly id: string;
    readonly ruleId: string;
    readonly title: string;
    readonly status: string;
    readonly outcome?: string | undefined;
    readonly severity?: string | undefined;
    readonly reviewerId?: string | undefined;
    readonly reviewerSource?: string | undefined;
    readonly note?: string | undefined;
    readonly createdAt: string;
}
export interface SubagentInsight {
    readonly delegations: number;
    readonly backgroundTransitions: number;
    readonly linkedBackgroundEvents: number;
    readonly uniqueAsyncTasks: number;
    readonly completedAsyncTasks: number;
    readonly unresolvedAsyncTasks: number;
}
export interface TagInsight {
    readonly tag: string;
    readonly count: number;
    readonly lanes: readonly TimelineLane[];
    readonly ruleIds: readonly string[];
    readonly lastSeenAt: string;
}
export interface TaskProcessSection {
    readonly lane: TimelineLane;
    readonly title: string;
    readonly items: readonly string[];
}
export interface TaskExtraction {
    readonly objective: string;
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly validations: readonly string[];
    readonly files: readonly string[];
    readonly brief: string;
    readonly processMarkdown: string;
}
export interface TimelineFilterOptions {
    readonly laneFilters: Readonly<Record<TimelineLane, boolean>>;
    readonly selectedTag?: string | null;
    readonly selectedRuleId?: string | null;
    readonly showRuleGapsOnly?: boolean;
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
        if (event.lane !== "exploration") {
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
        if (event.lane !== "exploration")
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
export function buildTaskExtraction(task: MonitoringTask | null | undefined, timeline: readonly TimelineEvent[], exploredFiles: readonly ExploredFileStat[]): TaskExtraction {
    const objective = inferTaskObjective(task, timeline);
    const sections = buildTaskProcessSections(timeline);
    const validations = collectTaskValidations(timeline);
    const files = exploredFiles.slice(0, 6).map((file) => file.path);
    const snapshot = buildReusableTaskSnapshot({ objective, events: timeline });
    const summary = snapshot.outcomeSummary ?? buildTaskSummary(timeline, sections, validations, files);
    const brief = buildTaskBrief(objective, summary, sections, validations);
    const processMarkdown = buildTaskProcessMarkdown(objective, summary, sections, validations, files);
    return {
        objective,
        summary,
        sections,
        validations,
        files,
        brief,
        processMarkdown
    };
}
export function buildTaskDisplayTitle(task: MonitoringTask | null | undefined, timeline: readonly TimelineEvent[]): string {
    const precomputedDisplayTitle = normalizeSentence(task?.displayTitle);
    if (precomputedDisplayTitle) {
        return precomputedDisplayTitle;
    }
    return resolvePreferredTaskTitle(task, timeline) ?? "Untitled task";
}
export function buildInspectorEventTitle(event: TimelineEvent | null | undefined, options?: {
    readonly taskDisplayTitle?: string | null;
    readonly limit?: number;
}): string | null {
    if (!event) {
        return null;
    }
    const overrideTitle = normalizeInspectorDisplayTitle(extractMetadataString(event.metadata, "displayTitle"));
    if (overrideTitle) {
        return overrideTitle;
    }
    if (event.kind === "task.start") {
        const taskDisplayTitle = normalizeInspectorDisplayTitle(options?.taskDisplayTitle ?? undefined);
        if (taskDisplayTitle) {
            return taskDisplayTitle;
        }
    }
    const limit = options?.limit ?? 80;
    const syntheticTitle = inferSyntheticInspectorTitle(event, limit);
    if (syntheticTitle) {
        return syntheticTitle;
    }
    const fallback = firstMeaningfulInspectorLine(event.title, event.body, extractMetadataString(event.metadata, "description"), extractMetadataString(event.metadata, "command"), extractMetadataString(event.metadata, "result"), extractMetadataString(event.metadata, "action"), extractMetadataString(event.metadata, "ruleId")) ?? normalizeInspectorDisplayTitle(event.title);
    return fallback ? truncateInspectorTitle(fallback, limit) : null;
}
export function buildRuleCoverage(timeline: readonly TimelineEvent[]): readonly RuleCoverageStat[] {
    const configuredRules = new Map<string, {
        ruleId: string;
        title: string;
        configured: boolean;
        lane: TimelineLane | undefined;
        tags: string[];
        matchCount: number;
        ruleEventCount: number;
        checkCount: number;
        violationCount: number;
        passCount: number;
        warningCount: number;
        blockedCount: number;
        approvalRequestCount: number;
        lastSeenAt: string | undefined;
    }>();
    for (const event of timeline) {
        const metadataRuleId = extractMetadataString(event.metadata, "ruleId");
        if (!metadataRuleId)
            continue;
        const existing = configuredRules.get(metadataRuleId);
        const next = existing ?? {
            ruleId: metadataRuleId,
            title: metadataRuleId,
            configured: false,
            lane: undefined,
            tags: [] as string[],
            matchCount: 0,
            ruleEventCount: 0,
            checkCount: 0,
            violationCount: 0,
            passCount: 0,
            warningCount: 0,
            blockedCount: 0,
            approvalRequestCount: 0,
            lastSeenAt: undefined as string | undefined
        };
        const ruleStatus = extractMetadataString(event.metadata, "ruleStatus");
        const ruleOutcome = extractMetadataString(event.metadata, "ruleOutcome");
        const rulePolicy = extractMetadataString(event.metadata, "rulePolicy");
        configuredRules.set(metadataRuleId, {
            ...next,
            ruleEventCount: next.ruleEventCount + 1,
            checkCount: next.checkCount + (ruleStatus === "check" ? 1 : 0),
            violationCount: next.violationCount + (ruleStatus === "violation" ? 1 : 0),
            passCount: next.passCount + ((ruleStatus === "pass" || ruleStatus === "fix-applied") ? 1 : 0),
            warningCount: next.warningCount + (ruleOutcome === "warned" || rulePolicy === "warn" ? 1 : 0),
            blockedCount: next.blockedCount + (ruleOutcome === "blocked" || rulePolicy === "block" ? 1 : 0),
            approvalRequestCount: next.approvalRequestCount + (ruleOutcome === "approval_requested" || rulePolicy === "approval_required" ? 1 : 0),
            lastSeenAt: next.lastSeenAt ? latestTimestamp(next.lastSeenAt, event.createdAt) : event.createdAt
        });
    }
    return [...configuredRules.values()].sort((left, right) => {
        if (right.violationCount !== left.violationCount) {
            return right.violationCount - left.violationCount;
        }
        if (right.ruleEventCount !== left.ruleEventCount) {
            return right.ruleEventCount - left.ruleEventCount;
        }
        if ((right.lastSeenAt ?? "") !== (left.lastSeenAt ?? "")) {
            return Date.parse(right.lastSeenAt ?? "1970-01-01T00:00:00.000Z")
                - Date.parse(left.lastSeenAt ?? "1970-01-01T00:00:00.000Z");
        }
        return left.title.localeCompare(right.title);
    });
}
export function collectRecentRuleDecisions(timeline: readonly TimelineEvent[], limit = 8): readonly RuleDecisionStat[] {
    return timeline
        .filter((event) => event.kind === "rule.logged")
        .map((event) => ({
        id: event.id,
        ruleId: extractMetadataString(event.metadata, "ruleId") ?? "rule",
        title: event.title,
        status: extractMetadataString(event.metadata, "ruleStatus") ?? "observed",
        ...(extractMetadataString(event.metadata, "ruleOutcome")
            ? { outcome: extractMetadataString(event.metadata, "ruleOutcome") }
            : {}),
        ...(extractMetadataString(event.metadata, "severity")
            ? { severity: extractMetadataString(event.metadata, "severity") }
            : {}),
        ...(extractMetadataString(event.metadata, "reviewerId")
            ? { reviewerId: extractMetadataString(event.metadata, "reviewerId") }
            : {}),
        ...(extractMetadataString(event.metadata, "reviewerSource")
            ? { reviewerSource: extractMetadataString(event.metadata, "reviewerSource") }
            : {}),
        ...(normalizeSentence(event.body ?? "")
            ? { note: normalizeSentence(event.body ?? "") ?? undefined }
            : {}),
        createdAt: event.createdAt
    }))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, limit);
}
export function buildTagInsights(timeline: readonly TimelineEvent[]): readonly TagInsight[] {
    const tags = new Map<string, {
        count: number;
        lanes: Set<TimelineLane>;
        ruleIds: Set<string>;
        lastSeenAt: string;
    }>();
    for (const event of timeline) {
        const eventRuleIds = collectEventRuleIds(event);
        for (const tag of event.classification.tags) {
            const existing = tags.get(tag);
            if (!existing) {
                tags.set(tag, {
                    count: 1,
                    lanes: new Set([event.lane]),
                    ruleIds: new Set(eventRuleIds),
                    lastSeenAt: event.createdAt
                });
                continue;
            }
            existing.count += 1;
            existing.lanes.add(event.lane);
            for (const ruleId of eventRuleIds) {
                existing.ruleIds.add(ruleId);
            }
            existing.lastSeenAt = latestTimestamp(existing.lastSeenAt, event.createdAt);
        }
    }
    return [...tags.entries()]
        .map(([tag, value]) => ({
        tag,
        count: value.count,
        lanes: [...value.lanes].sort(),
        ruleIds: [...value.ruleIds].sort(),
        lastSeenAt: value.lastSeenAt
    }))
        .sort((left, right) => {
        if (right.count !== left.count) {
            return right.count - left.count;
        }
        const timeDelta = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
        if (timeDelta !== 0) {
            return timeDelta;
        }
        return left.tag.localeCompare(right.tag);
    });
}
export function filterTimelineEvents(timeline: readonly TimelineEvent[], options: TimelineFilterOptions): readonly TimelineEvent[] {
    return timeline.filter((event) => {
        if (!options.laneFilters[event.lane]) {
            return false;
        }
        if (options.selectedTag && !eventHasTag(event, options.selectedTag)) {
            return false;
        }
        if (options.selectedRuleId && !eventHasRule(event, options.selectedRuleId)) {
            return false;
        }
        return !(options.showRuleGapsOnly && !eventHasRuleGap(event));
    });
}
export function eventHasTag(event: TimelineEvent, tag: string): boolean {
    return event.classification.tags.includes(tag);
}
export function eventHasRule(event: TimelineEvent, ruleId: string): boolean {
    return collectEventRuleIds(event).includes(ruleId);
}
export function eventHasRuleGap(event: TimelineEvent): boolean {
    return event.lane !== "user" && !extractMetadataString(event.metadata, "ruleId");
}
function collectEventRuleIds(event: TimelineEvent): readonly string[] {
    const ruleIds = new Set<string>();
    const metadataRuleId = extractMetadataString(event.metadata, "ruleId");
    if (metadataRuleId) {
        ruleIds.add(metadataRuleId);
    }
    return [...ruleIds];
}
function latestTimestamp(left: string, right: string): string {
    return Date.parse(left) > Date.parse(right) ? left : right;
}
const TASK_EXTRACTION_LANES: readonly TimelineLane[] = [
    "exploration",
    "planning",
    "coordination",
    "implementation"
];
const TASK_EXTRACTION_LANE_TITLES: Readonly<Record<TimelineLane, string>> = {
    user: "User Context",
    questions: "Track question flow",
    todos: "Track todo progress",
    exploration: "Explore the codebase",
    planning: "Plan the approach",
    coordination: "Coordinate tools and agents",
    implementation: "Implement the change",
    background: "Observe background work"
};
function isCompactEvent(event: TimelineEvent): boolean {
    return event.classification.tags.includes("compact")
        || extractMetadataBoolean(event.metadata, "compactEvent")
        || Boolean(extractMetadataString(event.metadata, "compactPhase"))
        || Boolean(extractMetadataString(event.metadata, "compactEventType"));
}
function inferTaskObjective(task: MonitoringTask | null | undefined, timeline: readonly TimelineEvent[]): string {
    return resolvePreferredTaskTitle(task, timeline) ?? "Reconstruct the selected task into a reusable process.";
}
const GENERIC_TASK_TITLE_PREFIXES = new Set([
    "agent",
    "ai cli",
    "aider",
    "claude",
    "claude code"
]);
function resolvePreferredTaskTitle(task: MonitoringTask | null | undefined, timeline: readonly TimelineEvent[]): string | null {
    return meaningfulTaskTitle(task) ?? inferTaskTitleSignal(timeline) ?? normalizeFallbackTaskTitle(task?.title);
}
function meaningfulTaskTitle(task: MonitoringTask | null | undefined): string | null {
    const title = normalizeSentence(task?.title);
    if (!title) {
        return null;
    }
    return isGenericWorkspaceTaskTitle(task, title) ? null : title;
}
function inferTaskTitleSignal(timeline: readonly TimelineEvent[]): string | null {
    const userGoal = timeline.find((event) => event.lane === "user"
        && event.kind !== "task.start"
        && event.kind !== "task.complete"
        && event.kind !== "task.error"
        && event.body)?.body;
    const startSummary = timeline.find((event) => event.kind === "task.start" && event.body)?.body;
    const firstMeaningfulEvent = timeline.find((event) => event.kind !== "task.start"
        && event.kind !== "task.complete"
        && event.kind !== "task.error"
        && event.kind !== "file.changed");
    return (meaningfulInferredTaskTitle(userGoal)
        ?? meaningfulInferredTaskTitle(startSummary)
        ?? meaningfulInferredTaskTitle(firstMeaningfulEvent?.body)
        ?? meaningfulInferredTaskTitle(firstMeaningfulEvent?.title));
}
function meaningfulInferredTaskTitle(value?: string): string | null {
    const normalized = normalizeSentence(value);
    if (!normalized || isAgentSessionBoilerplate(normalized)) {
        return null;
    }
    return normalized;
}
function isGenericWorkspaceTaskTitle(task: MonitoringTask | null | undefined, normalizedTitle: string): boolean {
    if (!task) {
        return false;
    }
    const segments = normalizedTitle.split(/\s+[—–-]\s+/);
    if (segments.length !== 2) {
        return false;
    }
    const [prefix, suffix] = segments;
    if (!prefix || !suffix) {
        return false;
    }
    const normalizedPrefix = normalizeTitleToken(prefix);
    if (!GENERIC_TASK_TITLE_PREFIXES.has(normalizedPrefix)) {
        return false;
    }
    const workspaceName = task.workspacePath
        ?.split("/")
        .filter(Boolean)
        .pop();
    const normalizedSuffix = normalizeTitleToken(stripTrailingSessionSuffix(suffix));
    return normalizedSuffix === normalizeTitleToken(task.slug)
        || (workspaceName ? normalizedSuffix === normalizeTitleToken(workspaceName) : false);
}
function normalizeFallbackTaskTitle(value?: string): string | null {
    const normalized = normalizeSentence(value);
    if (!normalized) {
        return null;
    }
    return stripTrailingSessionSuffix(normalized);
}
function stripTrailingSessionSuffix(value: string): string {
    return value.replace(/\s+\((?:ses_[^)]+|session[^)]*|sess[^)]*)\)\s*$/i, "").trim();
}
function normalizeTitleToken(value?: string): string {
    return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}
function isAgentSessionBoilerplate(value: string): boolean {
    const normalized = normalizeTitleToken(value);
    return /^(claude code|claude|agent|ai cli) session started\b/.test(normalized)
        || /^(claude code|claude|agent|ai cli) - /.test(normalized);
}
function buildTaskProcessSections(timeline: readonly TimelineEvent[]): readonly TaskProcessSection[] {
    return TASK_EXTRACTION_LANES
        .map((lane) => {
        const items = uniqueStrings(timeline
            .filter((event) => event.lane === lane)
            .map(describeProcessEvent)
            .filter((value): value is string => Boolean(value))).slice(0, 3);
        if (items.length === 0) {
            return null;
        }
        return {
            lane,
            title: TASK_EXTRACTION_LANE_TITLES[lane],
            items: items as readonly string[]
        };
    })
        .filter((value): value is TaskProcessSection => value !== null);
}
function collectTaskValidations(timeline: readonly TimelineEvent[]): readonly string[] {
    return uniqueStrings(timeline
        .filter((event) => event.kind === "verification.logged" || event.kind === "rule.logged")
        .map(describeValidationEvent)
        .filter((value): value is string => Boolean(value))).slice(0, 5);
}
function buildTaskSummary(timeline: readonly TimelineEvent[], sections: readonly TaskProcessSection[], validations: readonly string[], files: readonly string[]): string {
    const parts: string[] = [];
    const firstUserMsg = timeline.find(e => e.kind === "user.message");
    const originalRequest = firstUserMsg?.body ?? firstUserMsg?.title;
    const normalizedOriginalRequest = normalizeSentence(originalRequest);
    if (normalizedOriginalRequest) {
        parts.push(`Original request: ${normalizedOriginalRequest}`);
    }
    const implCount = timeline.filter(e => e.lane === "implementation").length;
    if (implCount > 0) {
        parts.push(`${implCount} implementation steps`);
    }
    if (validations.length > 0) {
        const failCount = timeline.filter(e => (e.kind === "verification.logged" && e.metadata["verificationStatus"] === "fail") ||
            (e.kind === "rule.logged" && e.metadata["ruleStatus"] === "violation")).length;
        const passCount = validations.length - failCount;
        parts.push(failCount > 0
            ? `Validation ${validations.length} runs (${passCount} passed, ${failCount} failed)`
            : `Validation ${validations.length} runs passed`);
    }
    if (files.length > 0) {
        parts.push(`${files.length} related files`);
    }
    if (parts.length === 0) {
        const laneText = sections.map(s => s.lane).join(", ");
        return laneText
            ? `${timeline.filter(e => e.kind !== "file.changed").length} recorded events (${laneText}).`
            : "Recorded task activity is available for extraction.";
    }
    return parts.join(". ") + ".";
}
function buildTaskBrief(objective: string, summary: string, sections: readonly TaskProcessSection[], validations: readonly string[]): string {
    const lines = [
        `Task: ${objective}`,
        `Summary: ${summary}`
    ];
    if (sections.length > 0) {
        lines.push("Process:");
        for (const section of sections) {
            for (const item of section.items) {
                lines.push(`- ${TASK_EXTRACTION_LANE_TITLES[section.lane]}: ${item}`);
            }
        }
    }
    if (validations.length > 0) {
        lines.push("Validation:");
        for (const item of validations) {
            lines.push(`- ${item}`);
        }
    }
    return lines.join("\n");
}
function buildTaskProcessMarkdown(objective: string, summary: string, sections: readonly TaskProcessSection[], validations: readonly string[], files: readonly string[]): string {
    const lines = [
        "# Extracted Task",
        "",
        `## Objective`,
        objective,
        "",
        "## Summary",
        summary
    ];
    if (sections.length > 0) {
        lines.push("", "## Process");
        for (const section of sections) {
            lines.push("", `### ${section.title}`);
            for (const item of section.items) {
                lines.push(`- ${item}`);
            }
        }
    }
    if (validations.length > 0) {
        lines.push("", "## Validation");
        for (const item of validations) {
            lines.push(`- ${item}`);
        }
    }
    if (files.length > 0) {
        lines.push("", "## Related Files");
        for (const filePath of files) {
            lines.push(`- ${filePath}`);
        }
    }
    return lines.join("\n");
}
function describeProcessEvent(event: TimelineEvent): string | null {
    if (event.kind === "file.changed" || event.kind === "task.complete" || event.kind === "task.error") {
        return null;
    }
    const title = normalizeSentence(event.title);
    const detail = primaryEventDetail(event);
    if (!title && !detail) {
        return null;
    }
    if (detail && title && normalizeForDedup(detail) !== normalizeForDedup(title)) {
        return `${title}: ${detail}`;
    }
    return detail ?? title;
}
function describeValidationEvent(event: TimelineEvent): string | null {
    if (event.kind === "verification.logged") {
        const title = normalizeSentence(event.title) ?? "Verification step";
        const result = normalizeSentence(extractMetadataString(event.metadata, "result")
            ?? extractMetadataString(event.metadata, "verificationStatus")
            ?? event.body);
        return result ? `${title}: ${result}` : title;
    }
    if (event.kind === "rule.logged") {
        const ruleId = extractMetadataString(event.metadata, "ruleId") ?? "rule";
        const status = extractMetadataString(event.metadata, "ruleStatus") ?? "observed";
        const severity = extractMetadataString(event.metadata, "severity");
        return severity
            ? `${ruleId} ${status} (${severity})`
            : `${ruleId} ${status}`;
    }
    return null;
}
function primaryEventDetail(event: TimelineEvent): string | null {
    const metadata = event.metadata;
    const candidates = [
        event.kind === "rule.logged"
            ? [
                extractMetadataString(metadata, "ruleId"),
                extractMetadataString(metadata, "ruleStatus"),
                extractMetadataString(metadata, "severity")
            ].filter((value): value is string => Boolean(value)).join(" · ")
            : undefined,
        event.kind === "verification.logged"
            ? extractMetadataString(metadata, "result")
            : undefined,
        extractMetadataString(metadata, "action"),
        extractMetadataString(metadata, "command"),
        extractMetadataString(metadata, "toolName"),
        event.body
    ];
    for (const candidate of candidates) {
        const normalized = normalizeSentence(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}
function uniqueStrings(values: readonly string[]): readonly string[] {
    const deduped = new Map<string, string>();
    for (const value of values) {
        const key = normalizeForDedup(value);
        if (!key || deduped.has(key)) {
            continue;
        }
        deduped.set(key, value);
    }
    return [...deduped.values()];
}
function normalizeForDedup(value: string): string {
    return value.trim().toLowerCase();
}
function normalizeSentence(value?: string): string | null {
    if (!value) {
        return null;
    }
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return null;
    }
    return normalized;
}
function normalizeInspectorDisplayTitle(value?: string): string | null {
    if (!value) {
        return null;
    }
    const normalized = value
        .replace(/\r/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
    return normalized || null;
}
function inferSyntheticInspectorTitle(event: TimelineEvent, limit: number): string | null {
    const title = event.title.trim();
    if (!title) {
        return null;
    }
    const contextMatch = title.match(/^\[context\]:\s*(.+)$/i);
    if (contextMatch?.[1]) {
        return truncateInspectorTitle(`Context: ${sanitizeInspectorLine(contextMatch[1])}`, limit);
    }
    if (/^\[search-mode\]/i.test(title)) {
        return "Search mode instructions";
    }
    if (/^\[analyze-mode\]/i.test(title)) {
        return "Analyze mode instructions";
    }
    if (/^<task-notification>/i.test(title)) {
        return "Task notification";
    }
    if (/^<system-reminder>/i.test(title)) {
        const description = extractLabeledInspectorValue(title, "Description");
        if (/\[background task completed\]/i.test(title)) {
            return description
                ? truncateInspectorTitle(`Background task completed: ${description}`, limit)
                : "Background task completed";
        }
        if (/\[background task error\]/i.test(title)) {
            return description
                ? truncateInspectorTitle(`Background task error: ${description}`, limit)
                : "Background task error";
        }
        if (/\[background task cancelled\]/i.test(title)) {
            return description
                ? truncateInspectorTitle(`Background task cancelled: ${description}`, limit)
                : "Background task cancelled";
        }
        if (/\[background task interrupt(?:ed)?\]/i.test(title)) {
            return description
                ? truncateInspectorTitle(`Background task interrupted: ${description}`, limit)
                : "Background task interrupted";
        }
        return "System reminder";
    }
    return null;
}
function extractLabeledInspectorValue(value: string, label: string): string | null {
    const pattern = new RegExp(`(?:\\*\\*${label}:\\*\\*|${label}:)\\s*(.+)`, "i");
    const match = value.match(pattern);
    if (!match?.[1]) {
        return null;
    }
    return sanitizeInspectorLine(match[1]);
}
function firstMeaningfulInspectorLine(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        if (!value) {
            continue;
        }
        const lines = value.split(/\r?\n/);
        for (const line of lines) {
            const sanitized = sanitizeInspectorLine(line);
            if (!sanitized || isIgnorableInspectorLine(sanitized)) {
                continue;
            }
            return sanitized;
        }
    }
    return null;
}
function sanitizeInspectorLine(value: string): string {
    return value
        .replace(/^\[context\]:\s*/i, "Context: ")
        .replace(/[*_`>#]+/g, "")
        .replace(/^[-•]\s+/, "")
        .replace(/<\/?[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function isIgnorableInspectorLine(value: string): boolean {
    const normalized = value.toLowerCase();
    return normalized === "system-reminder"
        || normalized === "task-notification"
        || normalized.startsWith("task-id")
        || normalized.startsWith("tool-use-id")
        || normalized.startsWith("output-file")
        || normalized.startsWith("id:");
}
function truncateInspectorTitle(value: string, limit: number): string {
    if (value.length <= limit) {
        return value;
    }
    const truncated = value.slice(0, Math.max(1, limit - 1)).trimEnd();
    const boundary = truncated.lastIndexOf(" ");
    const safe = boundary >= Math.floor(limit * 0.55)
        ? truncated.slice(0, boundary)
        : truncated;
    return `${safe}...`;
}
export interface QuestionGroup {
    readonly questionId: string;
    readonly phases: readonly {
        readonly phase: string;
        readonly event: TimelineEvent;
    }[];
    readonly isComplete: boolean;
}
export interface TodoGroup {
    readonly todoId: string;
    readonly title: string;
    readonly transitions: readonly {
        readonly state: string;
        readonly event: TimelineEvent;
    }[];
    readonly currentState: string;
    readonly isTerminal: boolean;
}
export interface ModelSummary {
    readonly defaultModelName?: string;
    readonly defaultModelProvider?: string;
    readonly modelCounts: Readonly<Record<string, number>>;
}
export function buildQuestionGroups(timeline: readonly TimelineEvent[]): readonly QuestionGroup[] {
    const PHASE_ORDER: Record<string, number> = { asked: 0, answered: 1, concluded: 2 };
    const groups = new Map<string, {
        phases: Array<{
            phase: string;
            event: TimelineEvent;
        }>;
    }>();
    for (const event of timeline) {
        if (event.kind !== "question.logged")
            continue;
        const questionId = extractMetadataString(event.metadata, "questionId");
        if (!questionId)
            continue;
        const phase = extractMetadataString(event.metadata, "questionPhase") ?? "asked";
        const existing = groups.get(questionId) ?? { phases: [] };
        existing.phases.push({ phase, event });
        groups.set(questionId, existing);
    }
    return [...groups.entries()].map(([questionId, group]) => {
        const sorted = [...group.phases].sort((a, b) => {
            const pDiff = (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99);
            if (pDiff !== 0)
                return pDiff;
            const aSeq = typeof a.event.metadata["sequence"] === "number" ? a.event.metadata["sequence"] : Infinity;
            const bSeq = typeof b.event.metadata["sequence"] === "number" ? b.event.metadata["sequence"] : Infinity;
            if (aSeq !== bSeq)
                return aSeq - bSeq;
            return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
        });
        return {
            questionId,
            phases: sorted,
            isComplete: sorted.some(p => p.phase === "concluded")
        };
    });
}
const TODO_TERMINAL_STATES = new Set(["completed", "cancelled"]);
const TODO_STATE_ORDER: Record<string, number> = { added: 0, in_progress: 1, completed: 2, cancelled: 2 };
export function buildTodoGroups(timeline: readonly TimelineEvent[]): readonly TodoGroup[] {
    const groups = new Map<string, {
        title: string;
        transitions: Array<{
            state: string;
            event: TimelineEvent;
        }>;
    }>();
    for (const event of timeline) {
        if (event.kind !== "todo.logged")
            continue;
        const todoId = extractMetadataString(event.metadata, "todoId");
        if (!todoId)
            continue;
        const state = extractMetadataString(event.metadata, "todoState") ?? "added";
        const existing = groups.get(todoId) ?? { title: event.title, transitions: [] };
        existing.transitions.push({ state, event });
        groups.set(todoId, existing);
    }
    return [...groups.entries()].map(([todoId, group]) => {
        const sorted = [...group.transitions].sort((a, b) => {
            const sDiff = (TODO_STATE_ORDER[a.state] ?? 99) - (TODO_STATE_ORDER[b.state] ?? 99);
            if (sDiff !== 0)
                return sDiff;
            const aSeq = typeof a.event.metadata["sequence"] === "number" ? a.event.metadata["sequence"] : Infinity;
            const bSeq = typeof b.event.metadata["sequence"] === "number" ? b.event.metadata["sequence"] : Infinity;
            if (aSeq !== bSeq)
                return aSeq - bSeq;
            return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
        });
        const last = sorted[sorted.length - 1];
        const currentState = last?.state ?? "added";
        return {
            todoId,
            title: group.title,
            transitions: sorted,
            currentState,
            isTerminal: TODO_TERMINAL_STATES.has(currentState)
        };
    });
}
export type MentionType = "file" | "directory";
export interface FileMentionVerification {
    readonly mentionType: "file";
    readonly path: string;
    readonly mentionedAt: string;
    readonly mentionedInEventId: string;
    readonly wasExplored: boolean;
    readonly firstExploredAt: string | undefined;
    readonly explorationCount: number;
    readonly exploredAfterMention: boolean;
}
export interface DirectoryMentionVerification {
    readonly mentionType: "directory";
    readonly path: string;
    readonly mentionedAt: string;
    readonly mentionedInEventId: string;
    readonly exploredFilesInFolder: readonly ExploredFileStat[];
    readonly wasExplored: boolean;
    readonly exploredAfterMention: boolean;
}
export type MentionedFileVerification = FileMentionVerification | DirectoryMentionVerification;
export function buildMentionedFileVerifications(timeline: readonly TimelineEvent[], exploredFiles: readonly ExploredFileStat[], workspacePath?: string): readonly MentionedFileVerification[] {
    const exploredMap = new Map(exploredFiles.map((f) => [f.path, f]));
    const allExploredPaths = exploredFiles.map((f) => f.path);
    const results: MentionedFileVerification[] = [];
    const seen = new Set<string>();
    for (const event of timeline) {
        if (event.kind !== "user.message") {
            continue;
        }
        const mentionedPaths = extractMetadataStringArray(event.metadata, "filePaths");
        const mentionedMs = Date.parse(event.createdAt);
        for (const mentionedPath of mentionedPaths) {
            if (seen.has(mentionedPath)) {
                continue;
            }
            seen.add(mentionedPath);
            if (isDirectoryPath(mentionedPath)) {
                const matchedPaths = filePathsInDirectory(mentionedPath, allExploredPaths, workspacePath);
                const exploredFilesInFolder = matchedPaths
                    .map((p) => exploredMap.get(p))
                    .filter((s): s is ExploredFileStat => s !== undefined);
                results.push({
                    mentionType: "directory",
                    path: mentionedPath,
                    mentionedAt: event.createdAt,
                    mentionedInEventId: event.id,
                    exploredFilesInFolder,
                    wasExplored: exploredFilesInFolder.length > 0,
                    exploredAfterMention: exploredFilesInFolder.some((s) => s.readTimestamps.some((t) => Date.parse(t) > mentionedMs))
                });
            }
            else {
                const matchedStat = findMatchingExploredFile(mentionedPath, exploredMap, workspacePath);
                results.push({
                    mentionType: "file",
                    path: mentionedPath,
                    mentionedAt: event.createdAt,
                    mentionedInEventId: event.id,
                    wasExplored: Boolean(matchedStat),
                    firstExploredAt: matchedStat?.firstSeenAt,
                    explorationCount: matchedStat?.count ?? 0,
                    exploredAfterMention: Boolean(matchedStat?.readTimestamps.some((t) => Date.parse(t) > mentionedMs))
                });
            }
        }
    }
    return results.sort((a, b) => Date.parse(a.mentionedAt) - Date.parse(b.mentionedAt));
}
function findMatchingExploredFile(mentionedPath: string, exploredMap: Map<string, ExploredFileStat>, workspacePath?: string): ExploredFileStat | undefined {
    const exact = exploredMap.get(mentionedPath);
    if (exact) {
        return exact;
    }
    for (const [exploredPath, stat] of exploredMap) {
        if (matchFilePaths(mentionedPath, exploredPath, workspacePath)) {
            return stat;
        }
    }
    return undefined;
}
export function buildModelSummary(timeline: readonly TimelineEvent[]): ModelSummary {
    const modelCounts: Record<string, number> = {};
    for (const event of timeline) {
        const modelName = extractMetadataString(event.metadata, "modelName");
        if (modelName) {
            modelCounts[modelName] = (modelCounts[modelName] ?? 0) + 1;
        }
    }
    const entries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
    const defaultModelName = entries[0]?.[0];
    const defaultModelProvider = defaultModelName
        ? extractMetadataString(timeline.find(e => extractMetadataString(e.metadata, "modelName") === defaultModelName)?.metadata ?? {}, "modelProvider")
        : undefined;
    return {
        ...(defaultModelName ? { defaultModelName } : {}),
        ...(defaultModelProvider ? { defaultModelProvider } : {}),
        modelCounts
    };
}
function extractMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
}
function extractMetadataBoolean(metadata: Record<string, unknown>, key: string): boolean {
    return metadata[key] === true;
}
function extractMetadataStringArray(metadata: Record<string, unknown>, key: string): readonly string[] {
    const value = metadata[key];
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}
export function collectViolationDescriptions(timeline: readonly TimelineEvent[]): readonly string[] {
    return timeline
        .filter(e => (e.kind === "verification.logged" && e.metadata["verificationStatus"] === "fail") ||
        (e.kind === "rule.logged" && e.metadata["ruleStatus"] === "violation"))
        .map(e => e.title);
}
export function collectPlanSteps(timeline: readonly TimelineEvent[]): readonly string[] {
    const planningEvents = timeline.filter(e => e.lane === "planning");
    const describedTerminals = timeline.filter(e => e.kind === "terminal.command"
        && Boolean(extractMetadataString(e.metadata, "description")));
    return uniqueStrings([...planningEvents, ...describedTerminals]
        .map(describeProcessEvent)
        .filter((v): v is string => Boolean(v)));
}
export interface HandoffOptions {
    readonly objective: string;
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly plans: readonly string[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
    readonly memo: string;
    readonly snapshot: ReusableTaskSnapshot;
    readonly mode: HandoffMode;
    readonly include: {
        readonly summary: boolean;
        readonly process: boolean;
        readonly plans: boolean;
        readonly files: boolean;
        readonly modifiedFiles: boolean;
        readonly todos: boolean;
        readonly violations: boolean;
        readonly questions: boolean;
    };
}
export type HandoffMode = "compact" | "standard" | "full";
export function buildHandoffPlain(options: HandoffOptions): string {
    const { objective, memo, include, snapshot, mode } = options;
    const { summary, sections, plans, exploredFiles, modifiedFiles, openTodos, openQuestions, violations } = selectHandoffViewData(options);
    const lines: string[] = [];
    lines.push(`Task: ${objective}`);
    lines.push(`Mode: ${mode}`);
    if (include.summary && summary) {
        lines.push(`Summary: ${summary}`);
    }
    if (snapshot.reuseWhen) {
        lines.push(`Reuse When: ${snapshot.reuseWhen}`);
    }
    if (include.plans && plans.length > 0) {
        lines.push("Plan:");
        for (const step of plans)
            lines.push(`- ${step}`);
    }
    if (include.process && sections.length > 0) {
        lines.push("Process:");
        for (const section of sections) {
            for (const item of section.items) {
                lines.push(`- ${section.lane}: ${item}`);
            }
        }
    }
    if (include.files && exploredFiles.length > 0) {
        lines.push(`Explored Files: ${exploredFiles.join(", ")}`);
    }
    if (include.modifiedFiles && modifiedFiles.length > 0) {
        lines.push(`Modified Files: ${modifiedFiles.join(", ")}`);
    }
    if (include.todos && openTodos.length > 0) {
        lines.push("Open TODOs:");
        for (const todo of openTodos)
            lines.push(`- ${todo}`);
    }
    if (include.violations && violations.length > 0) {
        lines.push("Violations:");
        for (const v of violations)
            lines.push(`- ${v}`);
    }
    if (snapshot.verificationSummary) {
        lines.push(`Verification: ${snapshot.verificationSummary}`);
    }
    if (include.questions && openQuestions.length > 0) {
        lines.push("Open Questions:");
        for (const q of openQuestions)
            lines.push(`- ${q}`);
    }
    if (memo.trim()) {
        lines.push(`Note: ${memo.trim()}`);
    }
    return lines.join("\n");
}
export function buildHandoffMarkdown(options: HandoffOptions): string {
    const { objective, memo, include, snapshot, mode } = options;
    const { summary, sections, plans, exploredFiles, modifiedFiles, openTodos, openQuestions, violations } = selectHandoffViewData(options);
    const parts: string[] = ["# Task Context", `\n## Objective\n${objective}`, `\n## Mode\n${mode}`];
    if (include.summary && summary) {
        parts.push(`\n## Summary\n${summary}`);
    }
    if (snapshot.reuseWhen) {
        parts.push(`\n## Reuse When\n${snapshot.reuseWhen}`);
    }
    if (include.plans && plans.length > 0) {
        parts.push(`\n## Plan\n${plans.map(p => `- ${p}`).join("\n")}`);
    }
    if (include.process && sections.length > 0) {
        const sectionLines = sections.map(s => `### ${s.title}\n${s.items.map(i => `- ${i}`).join("\n")}`);
        parts.push(`\n## Process\n${sectionLines.join("\n\n")}`);
    }
    if (include.files && exploredFiles.length > 0) {
        parts.push(`\n## Explored Files\n${exploredFiles.map(f => `- \`${f}\``).join("\n")}`);
    }
    if (include.modifiedFiles && modifiedFiles.length > 0) {
        parts.push(`\n## Modified Files\n${modifiedFiles.map(f => `- \`${f}\``).join("\n")}`);
    }
    if (include.todos && openTodos.length > 0) {
        parts.push(`\n## Open TODOs\n${openTodos.map(t => `- ${t}`).join("\n")}`);
    }
    if (include.violations && violations.length > 0) {
        parts.push(`\n## Violations\n${violations.map(v => `- ${v}`).join("\n")}`);
    }
    if (snapshot.verificationSummary) {
        parts.push(`\n## Verification\n- ${snapshot.verificationSummary}`);
    }
    if (include.questions && openQuestions.length > 0) {
        parts.push(`\n## Open Questions\n${openQuestions.map(q => `- ${q}`).join("\n")}`);
    }
    if (memo.trim()) {
        parts.push(`\n## Handoff Note\n${memo.trim()}`);
    }
    return parts.join("");
}
function cdata(s: string): string {
    return `<![CDATA[${s}]]>`;
}
export function buildHandoffXML(options: HandoffOptions): string {
    const { objective, memo, include, snapshot, mode } = options;
    const { summary, sections, plans, exploredFiles, modifiedFiles, openTodos, openQuestions, violations } = selectHandoffViewData(options);
    const lines: string[] = ["<context>"];
    lines.push(`  <objective>${cdata(objective)}</objective>`);
    lines.push(`  <mode>${cdata(mode)}</mode>`);
    if (include.summary && summary) {
        lines.push(`  <summary>${cdata(summary)}</summary>`);
    }
    if (snapshot.reuseWhen) {
        lines.push(`  <reuse_when>${cdata(snapshot.reuseWhen)}</reuse_when>`);
    }
    if (include.plans && plans.length > 0) {
        lines.push("  <plan>");
        for (const step of plans)
            lines.push(`    <step>${cdata(step)}</step>`);
        lines.push("  </plan>");
    }
    if (include.process && sections.length > 0) {
        lines.push("  <process>");
        for (const section of sections) {
            lines.push(`    <section lane="${section.lane}" title="${section.title}">`);
            for (const item of section.items) {
                lines.push(`      <step>${cdata(item)}</step>`);
            }
            lines.push("    </section>");
        }
        lines.push("  </process>");
    }
    if (include.files && exploredFiles.length > 0) {
        lines.push("  <explored_files>");
        for (const f of exploredFiles)
            lines.push(`    <file>${cdata(f)}</file>`);
        lines.push("  </explored_files>");
    }
    if (include.modifiedFiles && modifiedFiles.length > 0) {
        lines.push("  <modified_files>");
        for (const f of modifiedFiles)
            lines.push(`    <file>${cdata(f)}</file>`);
        lines.push("  </modified_files>");
    }
    if (include.todos && openTodos.length > 0) {
        lines.push("  <open_todos>");
        for (const t of openTodos)
            lines.push(`    <todo>${cdata(t)}</todo>`);
        lines.push("  </open_todos>");
    }
    if (include.violations && violations.length > 0) {
        lines.push(`  <violations count="${violations.length}">`);
        for (const v of violations)
            lines.push(`    <violation>${cdata(v)}</violation>`);
        lines.push("  </violations>");
    }
    if (snapshot.verificationSummary) {
        lines.push(`  <verification>${cdata(snapshot.verificationSummary)}</verification>`);
    }
    if (include.questions && openQuestions.length > 0) {
        lines.push("  <open_questions>");
        for (const q of openQuestions)
            lines.push(`    <question>${cdata(q)}</question>`);
        lines.push("  </open_questions>");
    }
    if (memo.trim()) {
        lines.push(`  <handoff_note>${cdata(memo.trim())}</handoff_note>`);
    }
    lines.push("</context>");
    return lines.join("\n");
}
export function buildHandoffSystemPrompt(options: HandoffOptions): string {
    const { objective, memo, include, snapshot, mode } = options;
    const { summary, sections, plans, exploredFiles, modifiedFiles, openTodos, openQuestions, violations } = selectHandoffViewData(options);
    const parts: string[] = [
        "You are continuing a software development task. Below is the full context from the previous session.",
        `\n## Task\n${objective}`,
        `\n## Handoff Mode\n${mode}`
    ];
    if (include.summary && summary) {
        parts.push(`\n## What was done\n${summary}`);
    }
    if (snapshot.reuseWhen) {
        parts.push(`\n## Reuse When\n${snapshot.reuseWhen}`);
    }
    if (include.plans && plans.length > 0) {
        parts.push(`\n## Plan\n${plans.map(p => `- ${p}`).join("\n")}`);
    }
    if (include.process && sections.length > 0) {
        const items = sections.flatMap(s => s.items.map(i => `- ${s.lane}: ${i}`));
        parts.push(`\n## Process steps\n${items.join("\n")}`);
    }
    if (include.files && exploredFiles.length > 0) {
        parts.push(`\n## Files explored\n${exploredFiles.map(f => `- ${f}`).join("\n")}`);
    }
    if (include.modifiedFiles && modifiedFiles.length > 0) {
        parts.push(`\n## Files modified\n${modifiedFiles.map(f => `- ${f}`).join("\n")}`);
    }
    if (include.todos && openTodos.length > 0) {
        parts.push(`\n## What still needs to be done\n${openTodos.map(t => `- ${t}`).join("\n")}`);
    }
    if (include.violations && violations.length > 0) {
        parts.push(`\n## Watch out for\n${violations.map(v => `- ${v}`).join("\n")}`);
    }
    if (snapshot.verificationSummary) {
        parts.push(`\n## Verification\n- ${snapshot.verificationSummary}`);
    }
    if (include.questions && openQuestions.length > 0) {
        parts.push(`\n## Open questions\n${openQuestions.map(q => `- ${q}`).join("\n")}`);
    }
    if (memo.trim()) {
        parts.push(`\n## Note from previous session\n${memo.trim()}`);
    }
    parts.push("\nBegin by acknowledging you have read this context, then ask what to tackle first.");
    return parts.join("");
}
function selectHandoffViewData(options: HandoffOptions): {
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly plans: readonly string[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
} {
    if (options.mode === "full") {
        return {
            summary: options.summary,
            sections: options.sections,
            plans: options.plans,
            exploredFiles: options.exploredFiles,
            modifiedFiles: options.modifiedFiles,
            openTodos: options.openTodos,
            openQuestions: options.openQuestions,
            violations: options.violations
        };
    }
    const compactSections: TaskProcessSection[] = [];
    if (options.snapshot.approachSummary) {
        compactSections.push({
            lane: "planning",
            title: "What Worked",
            items: [options.snapshot.approachSummary]
        });
    }
    if (options.snapshot.keyDecisions.length > 0) {
        compactSections.push({
            lane: "implementation",
            title: "Key Decisions",
            items: options.mode === "compact"
                ? options.snapshot.keyDecisions.slice(0, 3)
                : options.snapshot.keyDecisions
        });
    }
    const summaryLines = [
        options.snapshot.outcomeSummary ?? options.summary,
        options.mode === "standard" && options.snapshot.reuseWhen ? `Reuse when: ${options.snapshot.reuseWhen}` : null
    ].filter((value): value is string => Boolean(value));
    return {
        summary: summaryLines.join("\n"),
        sections: options.mode === "compact"
            ? compactSections
            : compactSections.length > 0
                ? [...compactSections, ...options.sections.map((section) => ({
                        ...section,
                        items: section.items.slice(0, 2)
                    }))]
                : options.sections.map((section) => ({ ...section, items: section.items.slice(0, 2) })),
        plans: (options.snapshot.nextSteps.length > 0 ? options.snapshot.nextSteps : options.plans)
            .slice(0, options.mode === "compact" ? 3 : 5),
        exploredFiles: (options.snapshot.keyFiles.length > 0 ? options.snapshot.keyFiles : options.exploredFiles)
            .slice(0, options.mode === "compact" ? 4 : 6),
        modifiedFiles: (options.snapshot.modifiedFiles.length > 0 ? options.snapshot.modifiedFiles : options.modifiedFiles)
            .slice(0, options.mode === "compact" ? 4 : 6),
        openTodos: options.openTodos.slice(0, options.mode === "compact" ? 3 : 4),
        openQuestions: options.openQuestions.slice(0, options.mode === "compact" ? 1 : 2),
        violations: uniqueStrings([
            ...options.snapshot.watchItems,
            ...options.violations
        ]).slice(0, options.mode === "compact" ? 4 : 6)
    };
}
