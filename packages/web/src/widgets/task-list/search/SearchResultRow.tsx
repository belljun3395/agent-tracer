import { Link } from "react-router-dom";
import type {
  EventSearchHit,
  MemoSearchHit,
  TaskSearchHit,
} from "~web/features/search/model/search.js";
import { TaskId, EventId } from "~web/shared/identity.js";
import type { StatusKind } from "~web/shared/ui/lib/status-kind.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, StatusDot } from "~web/shared/ui/index.js";
import { formatRelativeShort } from "~web/shared/lib/formatting/time.js";
import { laneThemeFor } from "~web/entities/task/model/lane-theme.js";

const STATUS_TO_DOT: Record<TaskSearchHit["status"], StatusKind> = {
  running: "running",
  waiting: "waiting",
  completed: "done",
  errored: "failed",
};

interface TaskHitRowProps {
  readonly hit: TaskSearchHit;
  readonly nowMs: number;
}

/** 태스크 검색 결과 한 행. */
export function TaskHitRow({ hit, nowMs }: TaskHitRowProps) {
  const guidance = useGuidance();
  const status = STATUS_TO_DOT[hit.status];
  return (
    <Link
      to={`/tasks/${hit.taskId}`}
      className="block px-2.5 py-2 mb-px rounded-sm border border-transparent hover:bg-s1"
    >
      <div className="flex items-center gap-2">
        <StatusDot
          status={status}
          tooltipContent={
            <GuidanceText
              locale={guidance.locale}
              message={guidance.messages.common.status[status]}
            />
          }
        />
        <span className="flex-1 min-w-0 truncate text-sm text-ink tracking-[-0.1px]">
          {hit.title}
        </span>
        <span className="font-mono text-[10.5px] text-ink-subtle">
          {formatRelativeShort(hit.updatedAt, nowMs)}
        </span>
      </div>
      {hit.workspacePath && (
        <div className="truncate mt-0.5 font-mono text-[10.5px] text-ink-tertiary">
          {hit.workspacePath}
        </div>
      )}
    </Link>
  );
}

interface EventHitRowProps {
  readonly hit: EventSearchHit;
}

/** 이벤트 검색 결과 한 행이며, 그 이벤트를 선택한 채로 태스크를 연다. */
export function EventHitRow({ hit }: EventHitRowProps) {
  const lane = laneThemeFor(hit.lane);

  return (
    <Link
      to={`/tasks/${TaskId(hit.taskId)}?event=${encodeURIComponent(EventId(hit.eventId))}`}
      className="block px-2.5 py-2 mb-px rounded-sm border border-transparent hover:bg-s1"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 rounded-[2px] shrink-0"
          style={{ background: lane.cssColor }}
        />
        <span
          className="font-mono text-[10px] font-semibold tracking-[0.08em]"
          style={{ color: lane.cssColor }}
        >
          {lane.label}
        </span>
        <span className="flex-1 min-w-0 truncate text-[12.5px] text-ink tracking-[-0.05px]">
          {hit.title}
        </span>
      </div>
      <div className="truncate mt-0.5 font-mono text-[10.5px] text-ink-tertiary">
        {hit.taskTitle}
      </div>
      {hit.snippet && (
        <p className="mt-1 mb-0 line-clamp-2 text-[11.5px] text-ink-subtle leading-[1.45]">
          {hit.snippet}
        </p>
      )}
    </Link>
  );
}

interface MemoHitRowProps {
  readonly hit: MemoSearchHit;
}

/** 메모 검색 결과 한 행이며, 이벤트에 매달린 메모면 그 이벤트를 선택한 채로 태스크를 연다. */
export function MemoHitRow({ hit }: MemoHitRowProps) {
  const to = hit.eventId
    ? `/tasks/${TaskId(hit.taskId)}?event=${encodeURIComponent(EventId(hit.eventId))}`
    : `/tasks/${TaskId(hit.taskId)}`;

  return (
    <Link
      to={to}
      className="block px-2.5 py-2 mb-px rounded-sm border border-transparent hover:bg-s1"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-tertiary">
          MEMO
        </span>
        <span className="font-mono text-[10.5px] text-ink-tertiary">{hit.author}</span>
      </div>
      <p className="mt-0.5 mb-0 line-clamp-2 text-[12.5px] text-ink tracking-[-0.05px] leading-[1.45]">
        {hit.body}
      </p>
    </Link>
  );
}
