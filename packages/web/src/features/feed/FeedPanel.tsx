import { lazy, Suspense, useMemo } from "react";
import type { TaskId } from "~domain/monitoring.js";
import { useTaskDetailQuery } from "~state/server/queries.js";
import { useMainView } from "~state/ui/index.js";
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
  const { data, isLoading, isError } = useTaskDetailQuery(taskId);
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
    return (
      <EmptyView
        eyebrow="Error"
        title="Couldn't load task"
        description="Check the monitor server connection or pick another task from the sidebar."
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
          <OverviewView taskId={taskId} timeline={data.timeline} />
        </Suspense>
      ) : (
        <div className="px-9">
          <ActList items={items} />
        </div>
      )}
    </div>
  );
}
