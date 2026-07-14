import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import type { TaskId } from "~web/shared/identity.js";
import { useLoadOlderTimelineMutation } from "~web/entities/task/api/timeline-mutations.js";
import {
  useTaskDetailQuery,
  useTaskVerificationsQuery,
} from "~web/entities/task/api/detail-queries.js";
import { useGuidance, useMainView } from "~web/shared/store/index.js";
import { isNotFoundError } from "~web/shared/api/client/response.js";
import { EmptyView } from "~web/shared/ui/index.js";
import { TaskHeader } from "~web/widgets/feed/header/TaskHeader.js";
import { ActList } from "~web/widgets/feed/timeline/ActList.js";
import { buildFeed } from "~web/widgets/feed/lib/timeline/group-acts.js";
import { selectResumeTarget } from "~web/widgets/feed/lib/resume/resume-target.js";

// Feed는 기본 뷰라 즉시 렌더링한다.
const GraphView = lazy(() =>
  import("~web/widgets/feed/graph/GraphView.js").then((module) => ({ default: module.GraphView })),
);

interface FeedPanelProps {
  readonly taskId: TaskId;
}

/** `/tasks/:taskId`의 메인 패널이며 다음을 조합한다. */
export function FeedPanel({ taskId }: FeedPanelProps) {
  const guidance = useGuidance();
  const { data, isLoading, isError, error } = useTaskDetailQuery(taskId);
  const loadOlderTimeline = useLoadOlderTimelineMutation(taskId);
  const mainView = useMainView();
  // VERI 레인은 Graph에서만 렌더링하므로 Feed에서는 추가 왕복을 생략한다.
  const { data: verifications } = useTaskVerificationsQuery(taskId, {
    enabled: mainView === "graph",
  });

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
    // 404/`not_found`는 태스크가 사라졌다는 뜻이다(다른 탭에서 삭제됐거나 URL의 id가 잘못됨).
    if (isNotFoundError(error)) {
      return (
        <EmptyView
          eyebrow="404"
          title="Task not found"
          description={guidance.messages.app.taskNotFound}
          locale={guidance.locale}
          action={
            <Link
              to="/tasks"
              className="inline-flex items-center px-3 py-1.5 rounded-xs border border-hair text-[12.5px] text-ink bg-s1"
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
        description={guidance.messages.app.taskServerUnavailable}
        locale={guidance.locale}
      />
    );
  }

  const resumeTarget = selectResumeTarget(data);

  return (
    <div className="flex flex-col min-h-0">
      <TaskHeader
        task={data.task}
        timeline={data.timeline}
        {...(resumeTarget ? { resumeTarget } : {})}
      />
      {data.olderCursor && (
        <div className="px-9 pb-2">
          <button
            type="button"
            onClick={() => loadOlderTimeline.mutate(data.olderCursor as string)}
            disabled={loadOlderTimeline.isPending}
            className="inline-flex items-center px-3 py-1.5 rounded-xs border border-hair text-[12.5px] text-ink-subtle bg-s1 disabled:opacity-50"
          >
            {loadOlderTimeline.isPending ? "Loading older events…" : "Load older events"}
          </button>
        </div>
      )}
      {data.timeline.length === 0 ? (
        <div className="px-9">
          <EmptyView
            eyebrow="Empty"
            title="No events yet"
            description={guidance.messages.app.eventsPending}
            locale={guidance.locale}
          />
        </div>
      ) : mainView === "graph" ? (
        <Suspense fallback={null}>
          <GraphView
            events={data.timeline}
            verifications={verifications ?? []}
            {...(data.turns ? { turns: data.turns } : {})}
            taskStatus={data.task.status}
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
