import { CLAUDE_BRIDGE_SOURCE, CLAUDE_HOOK_SOURCE, CLAUDE_PLUGIN_SOURCE } from "../../types/runtime-capabilities.types.js";
import { buildTaskDisplayTitle } from "../../types.js";
import type { MonitoringTask } from "../../types.js";
import { cn } from "./ui/cn.js";

export interface DisplayTaskRow {
    readonly task: MonitoringTask;
    readonly depth: 0 | 1;
}

export interface BuildTaskListRowsOptions {
    readonly collapsedParentIds?: ReadonlySet<string>;
}

export interface RuntimeFilterOption {
    readonly key: string;
    readonly label: string;
    readonly count: number;
}

export interface StatusFilterOption {
    readonly key: ConcreteTaskStatus;
    readonly count: number;
}

export type RailView = "tasks" | "saved";
export type ConcreteTaskStatus = MonitoringTask["status"];
export type StatusFilterKey = "all" | ConcreteTaskStatus;
export type StatusFilterState = Record<ConcreteTaskStatus, boolean>;

export const ALL_RUNTIME_FILTER_KEY = "all";
export const ALL_STATUS_FILTER_KEY: StatusFilterKey = "all";
export const TASK_STATUS_FILTER_KEYS = ["running", "waiting", "completed", "errored"] as const satisfies readonly ConcreteTaskStatus[];

interface TaskDisplayTitleCacheEntry {
    readonly title: string;
    readonly updatedAt: string;
}

export function resolveTaskListItemTitle(task: MonitoringTask, cachedTitle?: TaskDisplayTitleCacheEntry | null): string {
    if (cachedTitle && cachedTitle.updatedAt === task.updatedAt) {
        return cachedTitle.title;
    }
    return buildTaskDisplayTitle(task, []);
}

export function buildTaskListRows(tasks: readonly MonitoringTask[], options: BuildTaskListRowsOptions = {}): readonly DisplayTaskRow[] {
    if (tasks.length === 0) return [];
    const { collapsedParentIds = new Set<string>() } = options;
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const childrenByParentId = new Map<string, MonitoringTask[]>();
    const roots: MonitoringTask[] = [];
    for (const task of tasks) {
        const parentId = task.parentTaskId;
        if (!parentId || !taskById.has(parentId)) {
            roots.push(task);
            continue;
        }
        const children = childrenByParentId.get(parentId);
        if (children) {
            children.push(task);
            continue;
        }
        childrenByParentId.set(parentId, [task]);
    }
    const rows: DisplayTaskRow[] = [];
    const seen = new Set<string>();
    const compareByLatest = (a: MonitoringTask, b: MonitoringTask): number => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    const sortedRoots = [...roots].sort(compareByLatest);
    for (const root of sortedRoots) {
        if (seen.has(root.id)) continue;
        seen.add(root.id);
        rows.push({ task: root, depth: 0 });
        if (!collapsedParentIds.has(root.id)) {
            const children = [...(childrenByParentId.get(root.id) ?? [])].sort(compareByLatest);
            for (const child of children) {
                if (seen.has(child.id)) continue;
                seen.add(child.id);
                rows.push({ task: child, depth: 1 });
            }
        }
    }
    for (const task of tasks) {
        if (seen.has(task.id)) continue;
        if (task.parentTaskId && collapsedParentIds.has(task.parentTaskId)) continue;
        seen.add(task.id);
        rows.push({ task, depth: task.parentTaskId && taskById.has(task.parentTaskId) ? 1 : 0 });
    }
    return rows;
}

export function isPrimaryTask(task: MonitoringTask): boolean {
    return task.taskKind !== "background";
}

function runtimeTagSlug(source: string): string {
    if (source === CLAUDE_PLUGIN_SOURCE || source === CLAUDE_HOOK_SOURCE) return "claude";
    return "other";
}

export function runtimeBadgeClass(source: string): string {
    const slug = runtimeTagSlug(source);
    return cn(
        "ml-0 text-[0.6rem] normal-case",
        slug === "claude" && "border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]",
        slug === "other" && "border-[var(--border-1)] bg-[var(--bg-subtle)] text-[var(--text-2)]",
    );
}

export function runtimeTagLabel(source: string): string {
    if (source === CLAUDE_PLUGIN_SOURCE || source === CLAUDE_HOOK_SOURCE) return "Claude Code";
    if (source === CLAUDE_BRIDGE_SOURCE) return "Claude Bridge";
    return source;
}

export function runtimeObservabilityLabel(source?: string): string | null {
    if (!source) return null;
    if (source === CLAUDE_BRIDGE_SOURCE) return "Bridge observability";
    return null;
}

export function runtimeFilterKey(source?: string): string {
    if (!source) return "unknown";
    const slug = runtimeTagSlug(source);
    return slug === "other" ? `source:${source}` : slug;
}

function runtimeFilterLabel(key: string): string {
    if (key === ALL_RUNTIME_FILTER_KEY) return "All";
    if (key === "claude") return "Claude";
    if (key === "unknown") return "Unknown";
    return key.startsWith("source:") ? runtimeTagLabel(key.slice("source:".length)) : key;
}

export function filterTasksByRuntime(tasks: readonly MonitoringTask[], filterKey: string): readonly MonitoringTask[] {
    if (filterKey === ALL_RUNTIME_FILTER_KEY) return tasks;
    return tasks.filter((task) => runtimeFilterKey(task.runtimeSource) === filterKey);
}

export function buildRuntimeFilterOptions(tasks: readonly MonitoringTask[]): readonly RuntimeFilterOption[] {
    const counts = new Map<string, number>();
    for (const task of tasks) {
        const key = runtimeFilterKey(task.runtimeSource);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const customKeys = [...counts.keys()]
        .filter((key) => !["claude", "unknown"].includes(key))
        .sort((a, b) => runtimeFilterLabel(a).localeCompare(runtimeFilterLabel(b)));
    const orderedKeys = ["claude", ...customKeys, "unknown"].filter((key) => counts.has(key));
    return [
        { key: ALL_RUNTIME_FILTER_KEY, label: runtimeFilterLabel(ALL_RUNTIME_FILTER_KEY), count: tasks.length },
        ...orderedKeys.map((key) => ({ key, label: runtimeFilterLabel(key), count: counts.get(key) ?? 0 })),
    ];
}

export function filterTasksByPrimaryStatus(tasks: readonly MonitoringTask[], filters: Readonly<StatusFilterState>): readonly MonitoringTask[] {
    const enabledStatuses = new Set(
        TASK_STATUS_FILTER_KEYS.filter((status) => filters[status])
    );

    if (enabledStatuses.size === TASK_STATUS_FILTER_KEYS.length) return tasks;

    const visiblePrimaryIds = new Set(
        tasks
            .filter((task) => isPrimaryTask(task) && enabledStatuses.has(task.status))
            .map((task) => task.id)
    );

    return tasks.filter((task) => isPrimaryTask(task)
        ? visiblePrimaryIds.has(task.id)
        : Boolean(task.parentTaskId && visiblePrimaryIds.has(task.parentTaskId)));
}

export function buildStatusFilterOptions(tasks: readonly MonitoringTask[]): readonly StatusFilterOption[] {
    const counts = new Map<ConcreteTaskStatus, number>();
    for (const task of tasks) {
        if (!isPrimaryTask(task)) continue;
        counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }

    return TASK_STATUS_FILTER_KEYS.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}
