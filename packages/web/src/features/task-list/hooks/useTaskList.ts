import { useMemo } from "react";
import type { MonitoringTask } from "~domain/monitoring.js";
import { useTasksQuery } from "~state/server/queries.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import {
  useCollapsedParents,
  useLastSeenAt,
  useSelectedTaskId,
  useShowArchived,
  useSidebarFilter,
  useSidebarSearchQuery,
  useSidebarView,
  type SidebarFilter,
} from "~state/ui/index.js";
import {
  groupTasksByTime,
  type TaskGroupKey,
} from "../lib/group-tasks.js";
import { countByFilter, filterTasks } from "../lib/task-filter.js";
import { isTaskUnread } from "../lib/unread.js";
import { buildHierarchy } from "../lib/build-hierarchy.js";

export interface TaskRowVm {
  readonly task: MonitoringTask;
  readonly unread: boolean;
  /** 0 = root task; 1+ = subagent depth. */
  readonly depth: number;
  /** True when at least one child task lives under this row. */
  readonly hasChildren: boolean;
  /** True when this row's children have been hidden by the user. */
  readonly collapsed: boolean;
}

export interface TaskGroupVm {
  readonly key: TaskGroupKey;
  readonly label: string;
  readonly rows: readonly TaskRowVm[];
}

export interface TaskListVm {
  readonly groups: readonly TaskGroupVm[];
  readonly counts: Readonly<Record<SidebarFilter, number>>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  /**
   * Non-null when every visible task shares the same `runtimeSource`,
   * so the header can label the column once and rows can suppress the
   * redundant per-row tag.
   */
  readonly uniformRuntime: string | null;
  /**
   * Count of server-SDK tasks across the full payload (independent of
   * the current view) — surfaced next to the view switcher so users
   * notice activity even when the Tasks view is selected.
   */
  readonly subagentCount: number;
}

/**
 * Single source of truth for the sidebar's view-model.
 *
 * Pipeline:
 *   1. Apply filter + free-text search
 *   2. Bucket the survivors into Live / Today / Yesterday / Older
 *   3. Within each bucket, reshape parent → child tasks into a
 *      depth-first hierarchy so subagents render indented under their
 *      spawning task. Collapsed parents skip their children.
 *   4. Decorate each row with `unread`.
 */
export function useTaskList(): TaskListVm {
  const showArchived = useShowArchived();
  const { data, isLoading, isError } = useTasksQuery(
    showArchived ? "archived" : "active",
  );
  const filter = useSidebarFilter();
  const searchQuery = useSidebarSearchQuery();
  const lastSeenAt = useLastSeenAt();
  const collapsedParents = useCollapsedParents();
  const selectedTaskId = useSelectedTaskId();
  const view = useSidebarView();
  const nowMs = useNowMs(15_000);

  const allTasks = data?.tasks ?? [];

  // Partition once; counts + groups derive from the active partition.
  // Tasks view excludes server-SDK rows so they only surface under the
  // dedicated Subagent tasks view.
  const viewTasks = useMemo<readonly MonitoringTask[]>(() => {
    if (view === "subagents") {
      return allTasks.filter((t) => t.origin === "server-sdk");
    }
    return allTasks.filter((t) => (t.origin ?? "user") !== "server-sdk");
  }, [allTasks, view]);

  const subagentCount = useMemo(
    () => allTasks.filter((t) => t.origin === "server-sdk").length,
    [allTasks],
  );

  const counts = useMemo(() => countByFilter(viewTasks), [viewTasks]);

  const groups = useMemo<readonly TaskGroupVm[]>(() => {
    const filtered = filterTasks(viewTasks, filter, searchQuery);
    const grouped = groupTasksByTime(filtered, nowMs);
    const collapsedSet = new Set(collapsedParents);
    return grouped.map((g) => {
      const hierarchical = buildHierarchy(g.tasks, collapsedSet);
      return {
        key: g.key,
        label: g.label,
        rows: hierarchical.map((h) => ({
          task: h.task,
          // The currently selected task is the one the user is actively
          // viewing — keep it "read" even when fresh events stream in,
          // otherwise every WS update re-arms the pulse dot.
          unread:
            h.task.id !== selectedTaskId &&
            isTaskUnread(h.task, lastSeenAt),
          depth: h.depth,
          hasChildren: h.hasChildren,
          collapsed: collapsedSet.has(h.task.id),
        })),
      };
    });
  }, [
    viewTasks,
    filter,
    searchQuery,
    nowMs,
    lastSeenAt,
    collapsedParents,
    selectedTaskId,
  ]);

  const uniformRuntime = useMemo(() => {
    const first = viewTasks[0]?.runtimeSource ?? null;
    if (!first) return null;
    for (const t of viewTasks) {
      if ((t.runtimeSource ?? null) !== first) return null;
    }
    return first;
  }, [viewTasks]);

  return {
    groups,
    counts,
    subagentCount,
    isLoading,
    isError,
    uniformRuntime,
  };
}
