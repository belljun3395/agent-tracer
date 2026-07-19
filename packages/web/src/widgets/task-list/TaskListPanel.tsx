import { Fragment } from "react";
import { ScrollArea } from "~web/shared/ui/index.js";
import { useSidebarSearchQuery } from "~web/shared/store/index.js";
import { useDebouncedValue } from "~web/shared/lib/hooks/use-debounced-value.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { TaskListHeader } from "~web/widgets/task-list/TaskListHeader.js";
import { TaskListFilters } from "~web/widgets/task-list/TaskListFilters.js";
import { TaskListTagFilter } from "~web/widgets/task-list/TaskListTagFilter.js";
import { TaskGroupHeader } from "~web/widgets/task-list/TaskGroup.js";
import { TaskRow } from "~web/widgets/task-list/row/TaskRow.js";
import { TaskListFooter } from "~web/widgets/task-list/TaskListFooter.js";
import { SearchResultsPanel } from "~web/widgets/task-list/search/SearchResultsPanel.js";
import { SidebarViewSwitcher } from "~web/widgets/task-list/SidebarViewSwitcher.js";
import { useTaskList } from "~web/widgets/task-list/hooks/useTaskList.js";

/** `/tasks/*` 라우트의 사이드바 루트. */
export function TaskListPanel() {
  const {
    groups,
    counts,
    nowMs,
    subagentCount,
    isLoading,
    isError,
    hasMore,
    isFetchingMore,
    fetchMore,
    uniformRuntime,
  } = useTaskList();
  const sharedRuntime = uniformRuntime;
  const rawQuery = useSidebarSearchQuery();
  const query = useDebouncedValue(rawQuery, 250);
  const isSearching = query.trim().length > 0;

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="pt-2">
        <SidebarViewSwitcher
          {...(subagentCount !== undefined ? { subagentCount } : {})}
        />
        <TaskListHeader />
        {!isSearching && <TaskListFilters counts={counts} />}
        {!isSearching && <TaskListTagFilter />}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isSearching ? (
          <SearchResultsPanel query={query} />
        ) : (
          <div className="px-2 pt-1.5 pb-3.5">
            {isLoading && <Status label="Loading tasks…" />}
            {isError && <Status label="Failed to load tasks." tone="err" />}
            {!isLoading && !isError && groups.length === 0 && (
              <Status label="No tasks match the current filter." />
            )}
            {groups.map((group) => (
              <Fragment key={group.key}>
                <TaskGroupHeader
                  label={group.label}
                  count={group.rows.length}
                />
                {group.rows.map((row) => (
                  <TaskRow
                    key={row.task.id}
                    task={row.task}
                    unread={row.unread}
                    depth={row.depth}
                    hasChildren={row.hasChildren}
                    collapsed={row.collapsed}
                    hideRuntimeBadge={uniformRuntime !== null}
                    nowMs={nowMs}
                  />
                ))}
              </Fragment>
            ))}
            {!isLoading && !isError && hasMore && (
              <button
                type="button"
                onClick={fetchMore}
                disabled={isFetchingMore}
                className={cn(
                  "mt-2 w-full rounded-sm border border-hair px-3 py-2 text-xs hover:bg-s1 disabled:opacity-60 text-ink-subtle",
                  isFetchingMore ? "cursor-wait" : "cursor-pointer",
                )}
              >
                {isFetchingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </ScrollArea>

      <TaskListFooter
        {...(sharedRuntime ? { runtimeCaption: sharedRuntime } : {})}
      />
    </div>
  );
}

function Status({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "err";
}) {
  return (
    <div
      className={cn(
        "px-3 py-4 text-center text-xs",
        tone === "err" ? "text-err" : "text-ink-subtle",
      )}
    >
      {label}
    </div>
  );
}
