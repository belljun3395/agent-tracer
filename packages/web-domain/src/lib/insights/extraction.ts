import { buildReusableTaskSnapshot } from "@monitor/core";
import type { MonitoringTask, TimelineEvent, TimelineLane } from "../../types.js";
import type {
    ExploredFileStat,
    RuleDecisionStat,
    TagInsight,
    TaskExtraction,
    TaskProcessSection,
    TimelineFilterOptions
} from "./types.js";
import {
    extractMetadataString,
    normalizeForDedup,
    uniqueStrings
} from "./helpers.js";

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
export function describeProcessEvent(event: TimelineEvent): string | null {
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
