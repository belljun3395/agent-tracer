import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MonitoringTask } from "~domain/monitoring.js";
import {
  useSelectedTaskId,
  useToggleCollapsedParent,
} from "~state/ui/index.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import {
  useArchiveTaskMutation,
  useDeleteTaskMutation,
  useUnarchiveTaskMutation,
} from "~state/server/mutations.js";
import { StatusDot, Badge, Tooltip, type StatusKind } from "~ui/index.js";
import { cn } from "~lib/cn.js";
import { formatRelativeShort, formatAbsoluteHHmmss } from "~lib/time.js";

interface TaskRowProps {
  readonly task: MonitoringTask;
  readonly unread: boolean;
  /** 0 = root; 1+ = subagent depth (indented). */
  readonly depth: number;
  /** True when this task spawned subagent tasks. */
  readonly hasChildren: boolean;
  /** True when the user has collapsed this row's children. */
  readonly collapsed: boolean;
  /**
   * True when every visible task shares the same runtime source, so each
   * row can suppress the redundant tag (rendered once in the header).
   */
  readonly hideRuntimeBadge: boolean;
}

const STATUS_TO_DOT: Record<MonitoringTask["status"], StatusKind> = {
  running: "running",
  waiting: "waiting",
  completed: "done",
  errored: "failed",
};

/**
 * Sidebar row — uses `<Link>` so cmd-click opens the task in a new tab.
 * Visual states stack:
 *   - hover    : bg-s1; trash-can affordance fades in (opacity-0 → 100)
 *   - active   : bg-s2 + hair border + 2px primary stripe at left edge
 *   - unread   : bolder title + primary-coloured timestamp on the right.
 *                The previous left-edge dot+glow read as a notification
 *                badge and competed with the status dot + hierarchy
 *                guides; tying the signal to the timestamp keeps "new
 *                activity" co-located with "when" and frees the left
 *                column for the hierarchy.
 *   - subagent : depth>0, indented + connector elbow ("└─") drawn from
 *                the parent column, slightly smaller / dimmer title so
 *                the eye reads them as subordinate to the root task
 *
 * v1 hides the event/violation/approval counters because the tasks list
 * response doesn't carry those numbers yet (see plan v1 hide table).
 */
export function TaskRow({
  task,
  unread,
  depth,
  hasChildren,
  collapsed,
  hideRuntimeBadge,
}: TaskRowProps) {
  const selectedTaskId = useSelectedTaskId();
  const nowMs = useNowMs(15_000);
  const navigate = useNavigate();
  const deleteMutation = useDeleteTaskMutation();
  const archiveMutation = useArchiveTaskMutation();
  const unarchiveMutation = useUnarchiveTaskMutation();
  const toggleCollapsed = useToggleCollapsedParent();
  const [confirming, setConfirming] = useState(false);
  const active = selectedTaskId === task.id;
  const isArchived = Boolean(task.archivedAt);
  const isDeleting = deleteMutation.isPending;
  const isArchiving = archiveMutation.isPending;
  const isUnarchiving = unarchiveMutation.isPending;
  const deleteFailed =
    deleteMutation.isError && deleteMutation.variables === task.id;
  const archiveFailed =
    archiveMutation.isError && archiveMutation.variables === task.id;
  const unarchiveFailed =
    unarchiveMutation.isError && unarchiveMutation.variables === task.id;

  const handleDelete = (event: ReactMouseEvent<HTMLButtonElement>) => {
    // Stop the click from bubbling to the surrounding <Link>.
    event.preventDefault();
    event.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel the confirm prompt after a 5-second window so a
      // stray hover doesn't leave the row armed forever. The mouse-leave
      // handler on the row also cancels — see `disarm` below.
      window.setTimeout(() => setConfirming(false), 5000);
      return;
    }
    deleteMutation.mutate(task.id, {
      onSuccess: () => {
        // If the deleted task was the active one, drop URL selection.
        // React Router v7's navigate() may return a Promise; we don't
        // need to await it here (fire-and-forget transition).
        if (active) void navigate("/tasks");
      },
    });
  };

  const handleArchive = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    archiveMutation.mutate(task.id, {
      onSuccess: () => {
        if (active) void navigate("/tasks");
      },
    });
  };

  const handleUnarchive = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    unarchiveMutation.mutate(task.id);
  };

  // Disarm when the cursor leaves the row so the user can't come back
  // an hour later, miss-click the trash, and lose their task.
  const disarm = () => {
    if (confirming) setConfirming(false);
  };

  const handleToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toggleCollapsed(task.id);
  };

  const isSubagent = depth > 0;
  // Each ancestor's vertical guide sits at the center of its indent
  // column — `paddingLeft` starts at 10 and steps 20 per depth, so the
  // n-th ancestor guide lives at `10 + (n - 0.5) * 20` from the row's
  // left edge. We draw guides only for depths > 0.
  const guideXs: readonly number[] = isSubagent
    ? Array.from({ length: depth }, (_, i) => 10 + (i + 0.5) * 20)
    : [];

  return (
    <Link
      to={`/tasks/${task.id}`}
      onMouseLeave={disarm}
      onBlur={disarm}
      className={cn(
        "group relative block py-2 mb-px rounded-[var(--radius-sm)] border border-transparent",
        "hover:bg-[var(--s1)]",
        active && "bg-[var(--s2)] border-[var(--hair)]",
        (isDeleting || isArchiving || isUnarchiving) &&
          "opacity-50 pointer-events-none",
      )}
      style={{
        paddingLeft: 10 + depth * 20,
        paddingRight: 10,
      }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-px top-2.5 bottom-2.5 w-[2px] rounded-sm"
          style={{ background: "var(--primary)" }}
        />
      )}
      {/* Status-driven left-edge accent: `waiting` and `errored` rows
          deserve more weight than a 7px status dot can carry — a thin
          left stripe lets the eye spot "needs you" tasks while scanning
          the whole sidebar. Only renders when the row is not also the
          active route, so the active primary stripe wins on conflicts. */}
      {!active && (task.status === "waiting" || task.status === "errored") && (
        <span
          aria-hidden
          className="absolute -left-px top-2.5 bottom-2.5 w-[2px] rounded-sm"
          style={{
            background:
              task.status === "errored" ? "var(--err)" : "var(--warn)",
            opacity: 0.85,
          }}
        />
      )}
      {/* Hierarchy guides: a thin vertical line under each ancestor's
          indent column, plus a small elbow ("└") that hooks under the
          status dot on subagent rows. Pure decoration, aria-hidden. */}
      {guideXs.map((x, i) => (
        <span
          key={`guide-${i}`}
          aria-hidden
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: x,
            background:
              i === guideXs.length - 1
                ? "var(--hair-strong)"
                : "var(--hair)",
          }}
        />
      ))}
      {isSubagent && (
        <span
          aria-hidden
          className="absolute h-px"
          style={{
            // Elbow connects the rightmost vertical guide to the status
            // dot column. Sits at row vertical center.
            left: guideXs[guideXs.length - 1] ?? 0,
            top: "50%",
            width: 10,
            background: "var(--hair-strong)",
          }}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto minmax(0, 1fr) auto auto auto auto",
          alignItems: "center",
          columnGap: 8,
          marginBottom: 3,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={handleToggle}
            aria-label={collapsed ? "Expand subagents" : "Collapse subagents"}
            aria-expanded={!collapsed}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 16,
              width: 16,
              padding: 0,
              border: "none",
              background: "transparent",
              color: "var(--ink-muted)",
              cursor: "pointer",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 120ms",
            }}
          >
            <Chevron />
          </button>
        ) : (
          <span aria-hidden style={{ width: 16, height: 16 }} />
        )}
        <StatusDot
          status={STATUS_TO_DOT[task.status]}
          pulse={task.status === "running"}
        />
        <span
          style={{
            minWidth: 0,
            // Subagents render at a smaller, slightly dimmer style so
            // the eye reads them as subordinate to their root task at
            // a glance — depth alone is too subtle.
            fontSize: isSubagent ? 12 : 13,
            fontWeight: unread ? 600 : isSubagent ? 400 : 500,
            // `done` rows fade slightly so the eye prioritises live
            // and waiting tasks while scanning the list.
            color: isSubagent
              ? "var(--ink-muted)"
              : task.status === "completed"
                ? "var(--ink-muted)"
                : "var(--ink)",
            letterSpacing: "-0.1px",
            fontStyle: isSubagent ? "italic" : "normal",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.displayTitle ?? task.title}
        </span>
        {task.status === "waiting" && (
          <Badge variant="appr">await input</Badge>
        )}
        <Tooltip
          content={
            unread && !active
              ? `New activity since you last opened this task · ${formatAbsoluteHHmmss(task.updatedAt)}`
              : formatAbsoluteHHmmss(task.updatedAt)
          }
          side="left"
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color:
                unread && !active ? "var(--primary)" : "var(--ink-subtle)",
              fontWeight: unread && !active ? 600 : 400,
            }}
          >
            {formatRelativeShort(task.updatedAt, nowMs)}
          </span>
        </Tooltip>
        <Tooltip
          content={
            isArchived
              ? unarchiveFailed
                ? "Unarchive failed — try again"
                : "Unarchive task"
              : archiveFailed
                ? "Archive failed — try again"
                : "Archive task"
          }
          side="left"
        >
          <button
            type="button"
            onClick={isArchived ? handleUnarchive : handleArchive}
            aria-label={isArchived ? "Unarchive task" : "Archive task"}
            className={cn(
              "transition-opacity",
              archiveFailed || unarchiveFailed || isArchiving || isUnarchiving
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
            )}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 22,
              width: 22,
              borderRadius: "var(--radius-xs)",
              border: `1px solid ${
                archiveFailed || unarchiveFailed
                  ? "var(--err)"
                  : "var(--hair)"
              }`,
              background: "transparent",
              color:
                archiveFailed || unarchiveFailed
                  ? "var(--err)"
                  : "var(--ink-muted)",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            {isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          </button>
        </Tooltip>
        <Tooltip
          content={
            confirming
              ? "Click again to confirm"
              : deleteFailed
                ? "Delete failed — try again"
                : "Delete task"
          }
          side="left"
        >
          <button
            type="button"
            onClick={handleDelete}
            aria-label={confirming ? "Confirm delete" : "Delete task"}
            // Hidden until the row is hovered, focused, or while a
            // delete is in flight / armed — keeps the sidebar quiet
            // when 10+ rows are visible.
            className={cn(
              "transition-opacity",
              confirming || deleteFailed || isDeleting
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
            )}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 22,
              width: 22,
              borderRadius: "var(--radius-xs)",
              border: `1px solid ${
                deleteFailed || confirming ? "var(--err)" : "var(--hair)"
              }`,
              background: confirming
                ? "color-mix(in srgb, var(--err) 14%, transparent)"
                : "transparent",
              color:
                deleteFailed || confirming
                  ? "var(--err)"
                  : "var(--ink-muted)",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            <TrashIcon />
          </button>
        </Tooltip>
      </div>

      {!hideRuntimeBadge && task.runtimeSource && (
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-tertiary)",
          }}
        >
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="h-[5px] w-[5px] rounded-full"
              style={{ background: "var(--primary)" }}
            />
            {task.runtimeSource}
          </span>
        </div>
      )}
    </Link>
  );
}

function Chevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h18v3H3zM5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 14h4" />
    </svg>
  );
}

function UnarchiveIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h18v3H3zM5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M12 18v-6M9 15l3-3 3 3" />
    </svg>
  );
}
