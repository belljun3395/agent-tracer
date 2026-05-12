import { Fragment } from "react";
import { ScrollArea } from "~ui/index.js";
import { useSidebarSearchQuery } from "~state/ui/index.js";
import { useDebouncedValue } from "~lib/use-debounced-value.js";
import { TaskListHeader } from "./TaskListHeader.js";
import { TaskListFilters } from "./TaskListFilters.js";
import { TaskGroupHeader } from "./TaskGroup.js";
import { TaskRow } from "./TaskRow.js";
import { TaskListFooter } from "./TaskListFooter.js";
import { SearchResultsPanel } from "./SearchResultsPanel.js";
import { useTaskList } from "./hooks/useTaskList.js";

/**
 * Sidebar root for `/tasks/*` routes. Two render modes:
 *
 *   • IDLE   — search is empty: grouped task list (Live / Today / …)
 *   • SEARCH — search is non-empty: backend hits (Tasks + Events)
 *
 * Filter pills and footer stay consistent across both modes; only the
 * scrollable body switches.
 */
export function TaskListPanel() {
  const { groups, counts, isLoading, isError, uniformRuntime } = useTaskList();
  const sharedRuntime = uniformRuntime;
  const rawQuery = useSidebarSearchQuery();
  const query = useDebouncedValue(rawQuery, 250);
  const isSearching = query.trim().length > 0;

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="pt-2.5">
        <TaskListHeader />
        {!isSearching && <TaskListFilters counts={counts} />}
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
                  />
                ))}
              </Fragment>
            ))}
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
      className="px-3 py-4 text-center"
      style={{
        fontSize: 12,
        color: tone === "err" ? "var(--err)" : "var(--ink-subtle)",
      }}
    >
      {label}
    </div>
  );
}
