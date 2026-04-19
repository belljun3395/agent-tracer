import type { MonitoringTask, TimelineEvent } from "~domain/index.js";
import { isInternalEvent, isTaskLifecycleEvent, isUserLane } from "~domain/index.js";
import { GENERIC_TASK_TITLE_PREFIXES, MAX_TASK_TITLE_LENGTH, TRAILING_SESSION_SUFFIX_PATTERN, GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN, isAgentSessionBoilerplatePrefix } from "./task.display.title.service.const.js";
export function deriveTaskDisplayTitle(task: MonitoringTask | null | undefined, timeline: readonly TimelineEvent[]): string | undefined {
    return resolvePreferredTaskTitle(task, timeline) ?? undefined;
}
export function resolvePreferredTaskTitle(task: MonitoringTask | null | undefined, timeline: readonly TimelineEvent[]): string | null {
    return meaningfulTaskTitle(task) ?? inferTaskTitleSignal(timeline) ?? normalizeFallbackTaskTitle(task?.title);
}
export function meaningfulTaskTitle(task: MonitoringTask | null | undefined): string | null {
    const title = normalizeSentence(task?.title);
    if (!title) {
        return null;
    }
    return isGenericWorkspaceTaskTitle(task, title) ? null : title;
}
export function inferTaskTitleSignal(timeline: readonly TimelineEvent[]): string | null {
    const userGoal = timeline.find((event) => isUserLane(event.lane)
        && !isTaskLifecycleEvent(event)
        && event.body)?.body;
    const startSummary = timeline.find((event) => event.kind === "task.start" && event.body)?.body;
    const firstMeaningfulEvent = timeline.find((event) => !isInternalEvent(event));
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
    const segments = normalizedTitle.split(GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN);
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
export function normalizeFallbackTaskTitle(value?: string): string | null {
    const normalized = normalizeSentence(value);
    if (!normalized)
        return null;
    return stripTrailingSessionSuffix(normalized);
}
function stripTrailingSessionSuffix(value: string): string {
    return value.replace(TRAILING_SESSION_SUFFIX_PATTERN, "").trim();
}
function normalizeTitleToken(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function isAgentSessionBoilerplate(value: string): boolean {
    const normalized = normalizeTitleToken(value);
    return isAgentSessionBoilerplatePrefix(normalized);
}
function normalizeSentence(value?: string): string | null {
    if (!value) {
        return null;
    }
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return null;
    }
    return normalized.length > MAX_TASK_TITLE_LENGTH
        ? `${normalized.slice(0, MAX_TASK_TITLE_LENGTH - 3)}...`
        : normalized;
}
