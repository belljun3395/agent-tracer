import { useMemo } from "react";
import type { TaskId } from "~domain/monitoring.js";
import { useTaskDetailQuery } from "~state/server/queries.js";
import { buildFileActivity } from "~features/inspector/lib/file-activity.js";
import { formatRelativeShort } from "~lib/time.js";
import { useNowMs } from "~state/ui/useNowMs.js";

interface FileActivitySectionProps {
  readonly taskId: TaskId;
}

const MAX_ROWS = 12;

/**
 * Compact file activity rollup for the current task.
 *
 *   <path>                       7r · 2w · 5m   2h ago
 *
 * r = read count, w = write count, m = mention count. Top MAX_ROWS by
 * recency — operators most often want "what just got touched", not the
 * historical leaderboard.
 */
export function FileActivitySection({ taskId }: FileActivitySectionProps) {
  const { data } = useTaskDetailQuery(taskId);
  const nowMs = useNowMs(15_000);
  const rows = useMemo(() => {
    if (!data) return [];
    return buildFileActivity(data.timeline);
  }, [data]);

  if (rows.length === 0) return null;

  const visible = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <div className="mt-4 pt-3 border-t border-[var(--hair)]">
      <div
        className="flex items-center gap-2 mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>File activity</span>
        <span style={{ color: "var(--ink-muted)" }}>{rows.length}</span>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-1">
        {visible.map((row) => (
          <li
            key={row.path}
            className="flex items-center gap-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-muted)",
            }}
          >
            <span
              className="flex-1 min-w-0 truncate"
              style={{ color: "var(--ink)" }}
              title={row.path}
            >
              {row.path}
            </span>
            <span className="shrink-0" style={{ color: "var(--ink-tertiary)" }}>
              {[
                row.writeCount > 0 ? `${row.writeCount}w` : null,
                row.readCount > 0 ? `${row.readCount}r` : null,
                row.mentionCount > 0 ? `${row.mentionCount}m` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span
              className="shrink-0"
              style={{ color: "var(--ink-tertiary)", minWidth: 36, textAlign: "right" }}
            >
              {formatRelativeShort(row.lastSeenAtMs, nowMs)}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <div
          className="mt-1.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-tertiary)",
          }}
        >
          +{hidden} older paths
        </div>
      )}
    </div>
  );
}
