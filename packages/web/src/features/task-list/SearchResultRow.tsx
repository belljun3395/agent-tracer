import { Link } from "react-router-dom";
import type {
  EventSearchHit,
  TaskSearchHit,
} from "~domain/search-contracts.js";
import { TaskId, EventId } from "~domain/monitoring.js";
import { useSetSelectedEventId } from "~state/ui/index.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import { StatusDot, type StatusKind } from "~ui/index.js";
import { formatRelativeShort } from "~lib/time.js";
import { laneThemeFor } from "~features/feed/lib/lane-theme.js";

const STATUS_TO_DOT: Record<TaskSearchHit["status"], StatusKind> = {
  running: "running",
  waiting: "waiting",
  completed: "done",
  errored: "failed",
};

interface TaskHitRowProps {
  readonly hit: TaskSearchHit;
}

/**
 * One task search result. Visually parallels TaskRow so the user can
 * scan results without re-orienting; clicking opens the task page.
 */
export function TaskHitRow({ hit }: TaskHitRowProps) {
  const nowMs = useNowMs(15_000);
  return (
    <Link
      to={`/tasks/${hit.taskId}`}
      className="block px-2.5 py-2 mb-px rounded-[var(--radius-sm)] border border-transparent hover:bg-[var(--s1)]"
    >
      <div className="flex items-center gap-2">
        <StatusDot status={STATUS_TO_DOT[hit.status]} />
        <span
          className="flex-1 min-w-0 truncate"
          style={{
            fontSize: 13,
            color: "var(--ink)",
            letterSpacing: "-0.1px",
          }}
        >
          {hit.title}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-subtle)",
          }}
        >
          {formatRelativeShort(hit.updatedAt, nowMs)}
        </span>
      </div>
      {hit.workspacePath && (
        <div
          className="truncate mt-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-tertiary)",
          }}
        >
          {hit.workspacePath}
        </div>
      )}
    </Link>
  );
}

interface EventHitRowProps {
  readonly hit: EventSearchHit;
}

/**
 * One event search result. Click navigates to the parent task and
 * pre-selects the event so the Inspector lands on it immediately.
 */
export function EventHitRow({ hit }: EventHitRowProps) {
  const setSelectedEventId = useSetSelectedEventId();
  const lane = laneThemeFor(hit.lane);
  const onClick = () => {
    // Navigate happens via <Link>; pre-stage the selection so the
    // Inspector renders the right event without a click on the feed.
    setSelectedEventId(EventId(hit.eventId));
  };

  return (
    <Link
      to={`/tasks/${TaskId(hit.taskId)}`}
      onClick={onClick}
      className="block px-2.5 py-2 mb-px rounded-[var(--radius-sm)] border border-transparent hover:bg-[var(--s1)]"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 rounded-sm shrink-0"
          style={{ background: lane.cssColor }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: lane.cssColor,
          }}
        >
          {lane.label}
        </span>
        <span
          className="flex-1 min-w-0 truncate"
          style={{
            fontSize: 12.5,
            color: "var(--ink)",
            letterSpacing: "-0.05px",
          }}
        >
          {hit.title}
        </span>
      </div>
      <div
        className="truncate mt-0.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
        }}
      >
        {hit.taskTitle}
      </div>
      {hit.snippet && (
        <p
          className="mt-1 line-clamp-2"
          style={{
            margin: 0,
            fontSize: 11.5,
            color: "var(--ink-subtle)",
            lineHeight: 1.45,
          }}
        >
          {hit.snippet}
        </p>
      )}
    </Link>
  );
}
