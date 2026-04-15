import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { BookmarkRecord, MonitoringTask, TaskDetailResponse } from "@monitor/web-core";
import { formatRelativeTime } from "@monitor/web-core";
import { buildTaskDisplayTitle } from "@monitor/web-core";
import { useDragScroll } from "../lib/useDragScroll.js";
import { cn } from "../lib/ui/cn.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { PanelCard } from "./ui/PanelCard.js";
interface TaskDisplayTitleCacheEntry {
    readonly title: string;
    readonly updatedAt: string;
}
interface TaskListProps {
    readonly tasks: readonly MonitoringTask[];
    readonly bookmarks: readonly BookmarkRecord[];
    readonly taskDisplayTitleCache?: Readonly<Record<string, TaskDisplayTitleCacheEntry>>;
    readonly selectedTaskBookmarkId: string | null;
    readonly selectedTaskId: string | null;
    readonly taskDetail: TaskDetailResponse | null;
    readonly selectedTaskQuestionCount?: number | undefined;
    readonly selectedTaskTodoCount?: number | undefined;
    readonly deletingTaskId: string | null;
    readonly deleteErrorTaskId: string | null;
    readonly isCollapsed?: boolean;
    readonly hideHeader?: boolean;
    readonly hideTabs?: boolean;
    readonly initialView?: "tasks" | "saved";
    readonly onToggleCollapse?: () => void;
    readonly onSelectTask: (taskId: string) => void;
    readonly onSelectBookmark: (bookmark: BookmarkRecord) => void;
    readonly onDeleteBookmark: (bookmarkId: string) => void;
    readonly onSaveTaskBookmark: () => void;
    readonly onDeleteTask: (taskId: string) => void;
    readonly onRefresh: () => void;
}
interface DisplayTaskRow {
    readonly task: MonitoringTask;
    readonly depth: 0 | 1;
}
interface BuildTaskListRowsOptions {
    readonly collapsedParentIds?: ReadonlySet<string>;
}
interface RuntimeFilterOption {
    readonly key: string;
    readonly label: string;
    readonly count: number;
}
type RailView = "tasks" | "saved";
const railSectionHeaderClass = "sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]";
const railRowBaseClass = "group relative shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-transparent bg-transparent px-3 py-2 transition-[background-color,border-color,box-shadow] duration-200 hover:border-[var(--border)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] cursor-pointer";
const railSelectedRowClass = "border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] shadow-[var(--shadow-1)]";
const railContentButtonClass = "flex min-w-0 flex-col items-start justify-start rounded-none border-0 bg-transparent p-0 text-left font-normal shadow-none outline-none transition-colors";
const ALL_RUNTIME_FILTER_KEY = "all";
const railTabButtonClass = "relative flex-1 py-1.5 text-[0.74rem] font-medium transition-colors focus-visible:outline-none cursor-pointer";
const emptyStateCardClass = "m-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-3.5";

function EmptyRailState({ title, description, action }: {
    readonly title: string;
    readonly description: React.ReactNode;
    readonly action?: React.ReactNode;
}): React.JSX.Element {
    return (<div className={emptyStateCardClass}>
      <p className="m-0 text-[0.84rem] text-[var(--text-2)]">{title}</p>
      <p className="mt-1 m-0 text-[0.79rem] text-[var(--text-2)]">{description}</p>
      {action}
    </div>);
}

function RailTabButton({ active, children, onClick }: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
}): React.JSX.Element {
    return (<button aria-pressed={active} className={cn(railTabButtonClass, active ? "text-[var(--text-1)]" : "text-[var(--text-3)] hover:text-[var(--text-2)]")} onClick={onClick} type="button">
      {children}
      {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[var(--accent)]"/>}
    </button>);
}

function SavedBookmarkRow({ bookmark, isSelected, onSelectBookmark, onDeleteBookmark }: {
    readonly bookmark: BookmarkRecord;
    readonly isSelected: boolean;
    readonly onSelectBookmark: (bookmark: BookmarkRecord) => void;
    readonly onDeleteBookmark: (bookmarkId: string) => void;
}): React.JSX.Element {
    return (<div className={cn(railRowBaseClass, isSelected && railSelectedRowClass)}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>
        <button className={cn(railContentButtonClass, "min-w-0 flex-1")} onClick={() => onSelectBookmark(bookmark)} title={bookmark.title} type="button">
          <div className="w-full truncate text-[0.82rem] font-semibold leading-5 text-[var(--text-1)]">
            {bookmark.title}
          </div>
          <div className="mt-1 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.66rem] text-[var(--text-3)]">
            <Badge className="uppercase tracking-[0.06em]" size="sm" tone="accent">
              {bookmark.kind}
            </Badge>
            <span className="min-w-0 truncate font-mono text-[0.71rem]">
              {bookmark.eventTitle ?? bookmark.taskTitle ?? bookmark.taskId}
            </span>
            <span className="shrink-0">·</span>
            <span className="shrink-0">{formatRelativeTime(bookmark.updatedAt)}</span>
          </div>
        </button>
        <Button className="h-6 w-6 shrink-0 self-start rounded-md p-1 text-[var(--text-3)] opacity-0 transition-opacity hover:bg-[var(--err-bg)] hover:text-[var(--err)] group-hover:opacity-100" onClick={(event) => {
            event.stopPropagation();
            onDeleteBookmark(bookmark.id);
        }} size="icon" title="Remove saved item" variant="bare">
          <img alt="Remove saved item" className="icon-adaptive h-3.5 w-3.5" src="/icons/trash.svg"/>
        </Button>
      </div>
    </div>);
}

function TaskRuntimeMeta({ task }: {
    readonly task: MonitoringTask;
}): React.JSX.Element {
    return (<div className="mt-1 flex w-full min-w-0 items-center gap-1.5 text-[0.7rem] text-[var(--text-3)]">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", task.status === "running"
            ? "animate-pulse bg-[var(--ok)]"
            : task.status === "waiting"
                ? "bg-[var(--warn)]"
                : task.status === "completed"
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--err)]")}/>
      <span className="shrink-0 text-[0.68rem] font-medium capitalize">{task.status}</span>
      <span className="text-[var(--text-3)]/40">·</span>
      <span className="shrink-0">{formatRelativeTime(task.updatedAt)}</span>
      {task.runtimeSource && (<Badge className={cn(runtimeBadgeClass(task.runtimeSource), "ml-auto")} size="xs" tone="neutral">
          {runtimeTagLabel(task.runtimeSource)}
        </Badge>)}
      {task.taskKind === "background" && (<Badge className="border-[color-mix(in_srgb,#6366f1_30%,transparent)] bg-[color-mix(in_srgb,#6366f1_10%,transparent)] text-[#6366f1]" size="xs" tone="neutral">
          bg
        </Badge>)}
    </div>);
}

function SelectedTaskMeta({ task, taskDetail, selectedTaskId, selectedTaskQuestionCount, selectedTaskTodoCount }: {
    readonly task: MonitoringTask;
    readonly taskDetail: TaskDetailResponse | null;
    readonly selectedTaskId: string | null;
    readonly selectedTaskQuestionCount?: number | undefined;
    readonly selectedTaskTodoCount?: number | undefined;
}): React.JSX.Element | null {
    if (task.id !== selectedTaskId) {
        return null;
    }
    return (<div className="mt-1.5 flex w-full min-w-0 flex-col gap-1">
      {task.workspacePath && <div className="w-full truncate font-mono text-[0.67rem] text-[var(--text-3)]/60">{task.workspacePath}</div>}
      {task.id === taskDetail?.task.id && (<div className="flex flex-wrap gap-1.5">
          {selectedTaskQuestionCount !== undefined && selectedTaskQuestionCount > 0 && (<Badge className="border-[var(--user-border)] bg-[var(--user-bg)] text-[var(--user)]" size="xs" tone="neutral">
              {selectedTaskQuestionCount}Q
            </Badge>)}
          {selectedTaskTodoCount !== undefined && selectedTaskTodoCount > 0 && (<Badge className="border-[var(--planning-border)] bg-[var(--planning-bg)] text-[var(--planning)]" size="xs" tone="neutral">
              {selectedTaskTodoCount} todo{selectedTaskTodoCount === 1 ? "" : "s"}
            </Badge>)}
        </div>)}
    </div>);
}

function TaskRow({ task, depth, isSelected, isCollapsedParent, hasChildren, taskDisplayTitle, taskDetail, selectedTaskId, selectedTaskQuestionCount, selectedTaskTodoCount, deletingTaskId, deleteErrorTaskId, onSelectTask, onDeleteTask, onToggleCollapsedParent }: {
    readonly task: MonitoringTask;
    readonly depth: 0 | 1;
    readonly isSelected: boolean;
    readonly isCollapsedParent: boolean;
    readonly hasChildren: boolean;
    readonly taskDisplayTitle: string;
    readonly taskDetail: TaskDetailResponse | null;
    readonly selectedTaskId: string | null;
    readonly selectedTaskQuestionCount?: number | undefined;
    readonly selectedTaskTodoCount?: number | undefined;
    readonly deletingTaskId: string | null;
    readonly deleteErrorTaskId: string | null;
    readonly onSelectTask: (taskId: string) => void;
    readonly onDeleteTask: (taskId: string) => void;
    readonly onToggleCollapsedParent: (taskId: string) => void;
}): React.JSX.Element {
    return (<div className={cn(railRowBaseClass, depth > 0 &&
            "ml-3.5 pl-3.5 before:absolute before:bottom-2.5 before:left-1 before:top-2.5 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--implementation-border)_66%,transparent)] before:content-['']", isSelected && railSelectedRowClass)}>
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          {hasChildren ? (<Button aria-label={isCollapsedParent ? "Expand child tasks" : "Collapse child tasks"} className="mt-0.5 h-4 w-4 shrink-0 justify-start rounded-none p-0 text-[0.8rem] text-[var(--text-3)] hover:text-[var(--accent)]" onClick={() => onToggleCollapsedParent(task.id)} title={isCollapsedParent ? "Expand children" : "Collapse children"} variant="bare" size="icon">
              {isCollapsedParent ? "▸" : "▾"}
            </Button>) : (<span aria-hidden="true" className="mt-0.5 inline-block h-4 w-4 shrink-0"/>)}
        </div>

        <button className={cn(railContentButtonClass, "min-w-0 flex-1")} onClick={() => onSelectTask(task.id)} title={taskDisplayTitle} type="button">
          <div className="w-full truncate text-[0.8rem] font-semibold leading-5 text-[var(--text-1)]">
            {taskDisplayTitle}
          </div>
          <TaskRuntimeMeta task={task}/>
          <SelectedTaskMeta task={task} taskDetail={taskDetail} selectedTaskId={selectedTaskId} selectedTaskQuestionCount={selectedTaskQuestionCount} selectedTaskTodoCount={selectedTaskTodoCount}/>
        </button>

        <Button className={cn("h-6 w-6 shrink-0 rounded-md p-1 opacity-0 transition-opacity hover:bg-[var(--err-bg)] hover:opacity-100 group-hover:opacity-35", deleteErrorTaskId === task.id ? "text-[var(--err)] hover:text-[var(--err)]" : "text-[var(--text-3)]", deletingTaskId === task.id && "opacity-30")} disabled={deletingTaskId === task.id} onClick={(event) => {
            event.stopPropagation();
            onDeleteTask(task.id);
        }} size="icon" title="Delete task" variant="bare">
          <img alt="Delete" className="icon-adaptive h-3.5 w-3.5" src="/icons/trash.svg"/>
        </Button>
      </div>
    </div>);
}

export function TaskList({ tasks, bookmarks, taskDisplayTitleCache, selectedTaskBookmarkId, selectedTaskId, taskDetail, selectedTaskQuestionCount, selectedTaskTodoCount, deletingTaskId, deleteErrorTaskId, isCollapsed = false, hideHeader = false, hideTabs = false, initialView = "tasks", onToggleCollapse, onSelectTask, onSelectBookmark, onDeleteBookmark, onSaveTaskBookmark, onDeleteTask, onRefresh }: TaskListProps): React.JSX.Element {
    const [runtimeFilter, setRuntimeFilter] = useState<string>(ALL_RUNTIME_FILTER_KEY);
    const [collapsedParentIds, setCollapsedParentIds] = useState<ReadonlySet<string>>(new Set());
    const [railView, setRailView] = useState<RailView>(initialView);
    useEffect(() => {
        setRailView(initialView);
    }, [initialView]);
    const tasksDragScroll = useDragScroll({ axis: "y" });
    const runtimeFilterOptions = useMemo(() => buildRuntimeFilterOptions(tasks), [tasks]);
    const filteredTasks = useMemo(() => filterTasksByRuntime(tasks, runtimeFilter), [tasks, runtimeFilter]);
    const childCountByParentId = useMemo(() => {
        const counts = new Map<string, number>();
        for (const task of filteredTasks) {
            if (!task.parentTaskId)
                continue;
            const count = counts.get(task.parentTaskId) ?? 0;
            counts.set(task.parentTaskId, count + 1);
        }
        return counts;
    }, [filteredTasks]);
    const displayRows = useMemo(() => buildTaskListRows(filteredTasks, { collapsedParentIds }), [filteredTasks, collapsedParentIds]);
    useEffect(() => {
        if (runtimeFilterOptions.some((option) => option.key === runtimeFilter))
            return;
        setRuntimeFilter(ALL_RUNTIME_FILTER_KEY);
    }, [runtimeFilter, runtimeFilterOptions]);
    useEffect(() => {
        const validParentIds = new Set<string>(filteredTasks
            .filter((task) => (childCountByParentId.get(task.id) ?? 0) > 0)
            .map((task) => task.id));
        setCollapsedParentIds((current) => {
            const next = new Set<string>();
            for (const parentId of current) {
                if (validParentIds.has(parentId)) {
                    next.add(parentId);
                }
            }
            return next.size === current.size ? current : next;
        });
    }, [filteredTasks, childCountByParentId]);
    useEffect(() => {
        if (!selectedTaskId)
            return;
        const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId);
        const parentId = selectedTask?.parentTaskId;
        if (!parentId)
            return;
        setCollapsedParentIds((current) => {
            if (!current.has(parentId))
                return current;
            const next = new Set(current);
            next.delete(parentId);
            return next;
        });
    }, [selectedTaskId, filteredTasks]);
    return (<PanelCard className={cn("relative flex-1", isCollapsed && "items-center")}>
      {!hideHeader && (<Button aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("absolute right-2 top-2 h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[0.78rem] text-[var(--text-3)] transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface)] hover:text-[var(--text-2)]", isCollapsed && "static mx-auto mt-2")} onClick={onToggleCollapse} title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} variant="bare" size="icon">
          <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
            {isCollapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
          </svg>
        </Button>)}

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", isCollapsed && "hidden")}>
        {!hideHeader && (<div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-2),var(--surface))] px-4 py-3 pr-11">
            <p className="m-0 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Monitor</p>
            <h1 className="mt-1 text-[0.92rem] font-semibold tracking-[-0.02em] text-[var(--text-1)]">AI CLI Timeline</h1>
            <p className="mt-1 text-[0.74rem] leading-5 text-[var(--text-2)]">Live task observability for parallel agent work.</p>
          </div>)}


        
        {!hideTabs && (
        <div className="flex border-b border-[var(--border)]">
          <RailTabButton active={railView === "tasks"} onClick={() => setRailView("tasks")}>Tasks</RailTabButton>
          <RailTabButton active={railView === "saved"} onClick={() => setRailView("saved")}>Saved</RailTabButton>
        </div>
        )}

        {railView === "saved" ? (<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={railSectionHeaderClass}>
              <span>Saved</span>
            </div>

            {bookmarks.length === 0 ? (<EmptyRailState title="No saved cards yet." description="Save the current task or a selected event to come back to it quickly."/>) : (<div className="flex max-h-[calc(100%-2.5rem)] flex-col gap-1 overflow-y-auto p-1.5">
                {bookmarks.map((bookmark) => (<SavedBookmarkRow key={bookmark.id} bookmark={bookmark} isSelected={bookmark.id === selectedTaskBookmarkId} onSelectBookmark={onSelectBookmark} onDeleteBookmark={onDeleteBookmark}/>))}
              </div>)}
          </div>) : (<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={railSectionHeaderClass}>
              <span>Tracked Tasks</span>
              {filteredTasks.length > 10 && (<span className="ml-auto text-[0.62rem] font-normal normal-case tracking-normal text-[var(--text-3)]">
                  Drag to browse
                </span>)}
            </div>

            {tasks.length === 0 ? (<EmptyRailState title="No tasks yet." description={<>
                  Send <code>monitor_task_start</code> through the MCP server or POST to{" "}
                  <code>/api/task-start</code>.
                </>}/>) : (<>
                {runtimeFilterOptions.length > 1 && (<div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {runtimeFilterOptions.map((option) => {
                        const isActive = option.key === runtimeFilter;
                        return (<button key={option.key} aria-pressed={isActive} className={cn("inline-flex cursor-pointer items-center rounded-[var(--radius-sm)] px-2 py-0.75 text-[0.64rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]", isActive
                                ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                                : "text-[var(--text-3)] hover:bg-[var(--surface)] hover:text-[var(--text-2)]")} onClick={() => setRuntimeFilter(option.key)} type="button">
                            {option.label}
                          </button>);
                    })}
                    </div>
                  </div>)}

                {filteredTasks.length === 0 ? (<EmptyRailState title="No tasks match this runtime." description="" action={<button className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.72rem] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]" onClick={() => setRuntimeFilter(ALL_RUNTIME_FILTER_KEY)} type="button">
                      Show all tasks
                    </button>}/>) : (<div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1.5" style={{
                        cursor: tasksDragScroll.isDragging ? "grabbing" : "grab",
                        userSelect: tasksDragScroll.isDragging ? "none" : undefined
                    }} {...tasksDragScroll.handlers}>
                    {displayRows.map(({ task, depth }) => {
                        const taskDisplayTitle = resolveTaskListItemTitle(task, taskDisplayTitleCache?.[task.id]);
                        const childCount = childCountByParentId.get(task.id) ?? 0;
                        const hasChildren = childCount > 0;
                        const isCollapsedParent = collapsedParentIds.has(task.id);
                        return (<TaskRow key={task.id} task={task} depth={depth} isSelected={task.id === selectedTaskId} isCollapsedParent={isCollapsedParent} hasChildren={hasChildren} taskDisplayTitle={taskDisplayTitle} taskDetail={taskDetail} selectedTaskId={selectedTaskId} selectedTaskQuestionCount={selectedTaskQuestionCount} selectedTaskTodoCount={selectedTaskTodoCount} deletingTaskId={deletingTaskId} deleteErrorTaskId={deleteErrorTaskId} onSelectTask={onSelectTask} onDeleteTask={onDeleteTask} onToggleCollapsedParent={(taskId) => {
                                setCollapsedParentIds((current) => {
                                    const next = new Set(current);
                                    if (next.has(taskId)) {
                                        next.delete(taskId);
                                    }
                                    else {
                                        next.add(taskId);
                                    }
                                    return next;
                                });
                            }}/>);
                    })}
                  </div>)}
              </>)}
          </div>)}
      </div>
    </PanelCard>);
}
export function resolveTaskListItemTitle(task: MonitoringTask, cachedTitle?: TaskDisplayTitleCacheEntry | null): string {
    if (cachedTitle && cachedTitle.updatedAt === task.updatedAt) {
        return cachedTitle.title;
    }
    return buildTaskDisplayTitle(task, []);
}
export function buildTaskListRows(tasks: readonly MonitoringTask[], options: BuildTaskListRowsOptions = {}): readonly DisplayTaskRow[] {
    if (tasks.length === 0)
        return [];
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
        if (seen.has(root.id))
            continue;
        seen.add(root.id);
        rows.push({ task: root, depth: 0 });
        if (!collapsedParentIds.has(root.id)) {
            const children = [...(childrenByParentId.get(root.id) ?? [])].sort(compareByLatest);
            for (const child of children) {
                if (seen.has(child.id))
                    continue;
                seen.add(child.id);
                rows.push({ task: child, depth: 1 });
            }
        }
    }
    for (const task of tasks) {
        if (seen.has(task.id))
            continue;
        if (task.parentTaskId && collapsedParentIds.has(task.parentTaskId))
            continue;
        seen.add(task.id);
        rows.push({ task, depth: task.parentTaskId && taskById.has(task.parentTaskId) ? 1 : 0 });
    }
    return rows;
}
function runtimeTagSlug(source: string): string {
    if (source === "claude-plugin" || source === "claude-hook")
        return "claude";
    return "other";
}
function runtimeBadgeClass(source: string): string {
    const slug = runtimeTagSlug(source);
    return cn("ml-0 text-[0.6rem] normal-case", slug === "claude" && "border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]", slug === "other" && "border-[var(--border-1)] bg-[var(--bg-subtle)] text-[var(--text-2)]");
}
export function runtimeTagLabel(source: string): string {
    if (source === "claude-plugin" || source === "claude-hook")
        return "Claude Code";
    if (source === "claude-bridge")
        return "Claude Bridge";
    return source;
}
export function runtimeObservabilityLabel(source?: string): string | null {
    if (!source)
        return null;
    if (source === "claude-bridge")
        return "Bridge observability";
    return null;
}
export function runtimeFilterKey(source?: string): string {
    if (!source)
        return "unknown";
    const slug = runtimeTagSlug(source);
    return slug === "other" ? `source:${source}` : slug;
}
export function runtimeFilterLabel(key: string): string {
    if (key === ALL_RUNTIME_FILTER_KEY)
        return "All";
    if (key === "claude")
        return "Claude";
    if (key === "unknown")
        return "Unknown";
    return key.startsWith("source:") ? runtimeTagLabel(key.slice("source:".length)) : key;
}
export function filterTasksByRuntime(tasks: readonly MonitoringTask[], filterKey: string): readonly MonitoringTask[] {
    if (filterKey === ALL_RUNTIME_FILTER_KEY)
        return tasks;
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
    const orderedKeys = [
        "claude",
        ...customKeys,
        "unknown"
    ].filter((key) => counts.has(key));
    return [
        {
            key: ALL_RUNTIME_FILTER_KEY,
            label: runtimeFilterLabel(ALL_RUNTIME_FILTER_KEY),
            count: tasks.length
        },
        ...orderedKeys.map((key) => ({
            key,
            label: runtimeFilterLabel(key),
            count: counts.get(key) ?? 0
        }))
    ];
}
