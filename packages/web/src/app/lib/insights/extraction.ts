import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import { readRuleEnforcements } from "../ruleEnforcements.js";
import type {
    RuleDecisionStat,
    TimelineFilterOptions
} from "./types.js";
import {
    extractMetadataString,
} from "./helpers.js";

export function buildTaskDisplayTitle(task: MonitoringTask | null | undefined, timeline: readonly TimelineEventRecord[]): string {
    const precomputedDisplayTitle = normalizeSentence(task?.displayTitle);
    if (precomputedDisplayTitle) {
        return precomputedDisplayTitle;
    }
    return resolvePreferredTaskTitle(task, timeline) ?? "Untitled task";
}
export function buildInspectorEventTitle(event: TimelineEventRecord | null | undefined, options?: {
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
export function collectRecentRuleDecisions(timeline: readonly TimelineEventRecord[], limit = 8): readonly RuleDecisionStat[] {
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
export function filterTimelineEvents(timeline: readonly TimelineEventRecord[], options: TimelineFilterOptions): readonly TimelineEventRecord[] {
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
function eventHasTag(event: TimelineEventRecord, tag: string): boolean {
    return event.classification.tags.includes(tag);
}
function eventHasRule(event: TimelineEventRecord, ruleId: string): boolean {
    return collectEventRuleIds(event).includes(ruleId);
}
function eventHasRuleGap(event: TimelineEventRecord): boolean {
    return event.lane !== "user" && collectEventRuleIds(event).length === 0;
}
function collectEventRuleIds(event: TimelineEventRecord): readonly string[] {
    const ruleIds = new Set<string>();
    const metadataRuleId = extractMetadataString(event.metadata, "ruleId");
    if (metadataRuleId) {
        ruleIds.add(metadataRuleId);
    }
    for (const enforcement of readRuleEnforcements(event)) {
        ruleIds.add(enforcement.ruleId);
    }
    return [...ruleIds];
}
const GENERIC_TASK_TITLE_PREFIXES = new Set([
    "agent",
    "ai cli",
    "aider",
    "claude",
    "claude code",
    "codex",
    "codex app server",
    "codex app-server",
    "codex cli"
]);
function resolvePreferredTaskTitle(task: MonitoringTask | null | undefined, timeline: readonly TimelineEventRecord[]): string | null {
    return meaningfulTaskTitle(task) ?? inferTaskTitleSignal(timeline) ?? normalizeFallbackTaskTitle(task?.title);
}
function meaningfulTaskTitle(task: MonitoringTask | null | undefined): string | null {
    const title = normalizeSentence(task?.title);
    if (!title) {
        return null;
    }
    return isGenericWorkspaceTaskTitle(task, title) ? null : title;
}
function inferTaskTitleSignal(timeline: readonly TimelineEventRecord[]): string | null {
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
    return /^(claude code|claude|codex app-server|codex app server|codex cli|codex|agent|ai cli) session started\b/.test(normalized)
        || /^(claude code|claude|codex app-server|codex app server|codex cli|codex|agent|ai cli) - /.test(normalized);
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
function inferSyntheticInspectorTitle(event: TimelineEventRecord, limit: number): string | null {
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
