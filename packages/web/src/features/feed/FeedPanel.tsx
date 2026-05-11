import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import type { TaskId } from "~domain/monitoring.js";
import { useTaskDetailQuery } from "~state/server/queries.js";
import { useMainView } from "~state/ui/index.js";
import { isNotFoundError } from "~io/api.js";
import { EmptyView } from "~features/shell/index.js";
import { TaskHeader } from "./TaskHeader.js";
import { ActList } from "./ActList.js";
import { LaneFilter } from "./LaneFilter.js";
import { buildFeed } from "./lib/group-acts.js";

// Feed is the default view — rendered eagerly. Graph and Overview are
// gated behind the view toggle, so they ship as separate chunks and
// only download when the user actually picks them.
const GraphView = lazy(() =>
  import("./graph/index.js").then((m) => ({ default: m.GraphView })),
);
const OverviewView = lazy(() =>
  import("./OverviewView.js").then((m) => ({ default: m.OverviewView })),
);

interface FeedPanelProps {
  readonly taskId: TaskId;
}

/**
 * Main pane for `/tasks/:taskId`. Composes:
 *   1. TaskHeader (eyebrow + h1 + byline + view-toggle + metric rail)
 *   2. ActList    (vertical timeline) — when mainView === 'feed'
 *      OR
 *      GraphView  (swimlane SVG)      — when mainView === 'graph'
 *
 * Loading / error / empty states all reuse the shared EmptyView so the
 * shell never renders skeleton-style placeholders that look like real data.
 */
export function FeedPanel({ taskId }: FeedPanelProps) {
  const { data, isLoading, isError, error } = useTaskDetailQuery(taskId);
  const mainView = useMainView();

  const items = useMemo(() => {
    if (!data) return [];
    const baseMs = Date.parse(
      data.task.lastSessionStartedAt ?? data.task.createdAt,
    );
    return buildFeed(data.timeline, baseMs, data.turns);
  }, [data]);

  if (isLoading) {
    return <EmptyView eyebrow="Loading" title="Fetching task timeline…" />;
  }
  if (isError || !data) {
    // 404 / `not_found` means the task is gone (deleted in another tab,
    // wrong id in the URL). Everything else (offline, 5xx) collapses
    // into a "the server can't answer right now" message so we don't
    // tell the user to "pick another task" when there's nothing wrong
    // with their pick.
    if (isNotFoundError(error)) {
      return (
        <EmptyView
          eyebrow="404"
          title="Task not found"
          description="It may have been deleted in another tab, or the link points at a stale id."
          action={
            <Link
              to="/tasks"
              className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-xs)] border border-[var(--hair)]"
              style={{
                fontSize: 12.5,
                color: "var(--ink)",
                background: "var(--s1)",
              }}
            >
              Back to tasks
            </Link>
          }
        />
      );
    }
    return (
      <EmptyView
        eyebrow="Error"
        title="Couldn't load task"
        description="The monitor server didn't respond — check that it's running on the configured port and try again."
      />
    );
  }

  // Surface the runtime session id so operators can resume the agent
  // (`claude --resume <id>` or codex equivalent). Falls back through:
  //   1. TaskDetailResponse.runtimeSessionId  (preferred — task-scoped)
  //   2. The first turn's sessionId           (fallback when the server
  //                                             didn't denormalise it onto
  //                                             the task)
  const sessionId =
    data.runtimeSessionId ?? data.turns?.[0]?.sessionId ?? null;

  return (
    <div className="flex flex-col min-h-0">
      <TaskHeader
        task={data.task}
        timeline={data.timeline}
        {...(sessionId ? { sessionId } : {})}
      />
      {(mainView === "feed" || mainView === "graph") &&
        data.timeline.length > 0 && (
          <div className="px-9 pb-2">
            <LaneFilter />
          </div>
        )}
      {data.timeline.length === 0 ? (
        <div className="px-9">
          <EmptyView
            eyebrow="Empty"
            title="No events yet"
            description="Events will appear here as the agent runs."
          />
        </div>
      ) : mainView === "graph" ? (
        <Suspense fallback={null}>
          <GraphView
            events={data.timeline}
            {...(data.turns ? { turns: data.turns } : {})}
            taskStatus={data.task.status}
          />
        </Suspense>
      ) : mainView === "overview" ? (
        <Suspense fallback={null}>
          <OverviewView
            taskId={taskId}
            timeline={data.timeline}
            {...(data.task.workspacePath
              ? { workspacePath: data.task.workspacePath }
              : {})}
          />
        </Suspense>
      ) : (
        <div className="px-9">
          <ActList items={items} />
        </div>
      )}
    </div>
  );
}
