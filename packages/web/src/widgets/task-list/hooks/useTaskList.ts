import { useMemo } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { useTaskPagesQuery } from "~web/entities/task/api/list-queries.js";
import { useTaskIdsForTagsQuery } from "~web/entities/tag/api/queries.js";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";
import {
  useCollapsedParents,
  useLastSeenAt,
  useSelectedTaskId,
  useShowArchived,
  useSidebarFilter,
  useSidebarSearchQuery,
  useSidebarTagFilter,
  useSidebarView,
  type SidebarFilter,
} from "~web/shared/store/index.js";
import { countByFilter, filterTasks } from "~web/widgets/task-list/model/task-filter.js";
import { type TaskGroupKey } from "~web/widgets/task-list/lib/group-tasks.js";
import { isTaskUnread } from "~web/widgets/task-list/lib/unread.js";
import { groupHierarchically } from "~web/widgets/task-list/lib/group-hierarchy.js";
import { flattenTaskPages } from "~web/entities/task/model/task-pagination.js";

export interface TaskRowVm {
  readonly task: MonitoringTask;
  readonly unread: boolean;
  /** 0은 루트 태스크, 1 이상은 서브에이전트 깊이. */
  readonly depth: number;
  /** 이 행 아래 자식 태스크가 하나라도 있으면 true. */
  readonly hasChildren: boolean;
  /** 사용자가 이 행의 자식들을 숨겼으면 true. */
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
  readonly nowMs: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly hasMore: boolean;
  readonly isFetchingMore: boolean;
  readonly fetchMore: () => void;
  /** 보이는 모든 태스크가 같은 `runtimeSource`를 공유할 때만 null이 아니다. */
  readonly uniformRuntime: string | null;
  /** 현재 뷰와 무관하게 전체 페이로드에서 server-SDK 태스크 수를 센다. */
  readonly subagentCount?: number;
}

/** 사이드바 뷰모델의 단일 진실 원천이다. */
export function useTaskList(): TaskListVm {
  const showArchived = useShowArchived();
  const filter = useSidebarFilter();
  const searchQuery = useSidebarSearchQuery();
  const tagFilter = useSidebarTagFilter();
  const lastSeenAt = useLastSeenAt();
  const collapsedParents = useCollapsedParents();
  const selectedTaskId = useSelectedTaskId();
  const view = useSidebarView();
  const nowMs = useNowMs(15_000);
  const { taskIds: tagEligibleTaskIds } = useTaskIdsForTagsQuery(tagFilter);
  const origin = view === "subagents" ? "server-sdk" : "user";
  // `filter`(live/attn/done)는 구체적인 태스크 상태를 묶은 클라이언트 전용 집계값이다.
  const pages = useTaskPagesQuery({
    archived: showArchived ? "archived" : "active",
    origin,
    limit: 100,
  });

  const allTasks = useMemo(
    () => flattenTaskPages(pages.data?.pages ?? []),
    [pages.data],
  );

  // 한 번만 분할하고 counts와 groups는 이 분할 결과에서 파생시킨다.
  const viewTasks = useMemo<readonly MonitoringTask[]>(() => {
    if (view === "subagents") {
      return allTasks.filter((t) => t.origin === "server-sdk");
    }
    return allTasks.filter((t) => (t.origin ?? "user") !== "server-sdk");
  }, [allTasks, view]);

  const counts = useMemo(() => countByFilter(viewTasks), [viewTasks]);

  const groups = useMemo<readonly TaskGroupVm[]>(() => {
    const filtered = filterTasks(viewTasks, filter, searchQuery, tagEligibleTaskIds);
    const collapsedSet = new Set(collapsedParents);
    return groupHierarchically(filtered, collapsedSet, nowMs).map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.rows.map((h) => ({
        task: h.task,
        // 현재 선택된 태스크는 사용자가 보고 있는 태스크이므로, 새 이벤트가 스트리밍돼도 "읽음" 상태를 유지한다.
        unread: h.task.id !== selectedTaskId && isTaskUnread(h.task, lastSeenAt),
        depth: h.depth,
        hasChildren: h.hasChildren,
        collapsed: collapsedSet.has(h.task.id),
      })),
    }));
  }, [
    viewTasks,
    filter,
    searchQuery,
    tagEligibleTaskIds,
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
    nowMs,
    isLoading: pages.isLoading,
    isError: pages.isError,
    hasMore: pages.hasNextPage,
    isFetchingMore: pages.isFetchingNextPage,
    fetchMore: () => {
      void pages.fetchNextPage();
    },
    uniformRuntime,
  };
}
