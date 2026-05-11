import { useMemo } from "react";
import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import { formatDuration } from "./lib/format-time.js";
import { extractContextSnapshot } from "./lib/extract-context.js";
import { buildContextTrajectory } from "./lib/extract-context-trajectory.js";
import { isContextCompactEvent } from "./lib/is-compact.js";
import { ContextSparkline } from "./ContextSparkline.js";

interface MetricRailProps {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEventRecord[];
}

/**
 * Compact metrics strip below the task header.
 *
 *   Active   : startedAt → now
 *   Compacts : count of true PreCompact / PostCompact events (filtered
 *              by `metadata.compactPhase` to exclude the many other
 *              hooks that piggy-back on `kind: 'context.saved'`)
 *   Context  : latest context-window utilisation as a percent, plus a
 *              sparkline of the trajectory across the task
 *
 * Cells with no underlying data are hidden entirely — never render "—".
 */
export function MetricRail({ task, timeline }: MetricRailProps) {
  const nowMs = useNowMs(60_000);
  const startMs = Date.parse(task.lastSessionStartedAt ?? task.createdAt);
  const elapsedMs = Math.max(0, nowMs - startMs);
  const compactCount = timeline.filter(isContextCompactEvent).length;
  const ctx = extractContextSnapshot(timeline);
  const trajectory = useMemo(
    () => buildContextTrajectory(timeline),
    [timeline],
  );

  return (
    <div
      className="flex items-center gap-5 border-t border-[var(--hair)] mt-3 pt-2.5"
      style={{ background: "transparent" }}
    >
      <Cell
        label="Active"
        value={formatDuration(elapsedMs)}
        title="Wall-clock time since the task's session started"
      />
      <Cell
        label="Compacts"
        value={compactCount.toString()}
        title="Number of context-window compactions performed during this task"
      />
      {ctx && (
        <Cell
          label="Context"
          value={`${ctx.percent}%`}
          title="Most recent context-window utilisation reported by the status-line script"
          chart={
            trajectory.length >= 2 ? (
              <ContextSparkline points={trajectory} width={120} height={20} />
            ) : null
          }
          {...(ctx.percent >= 95
            ? { tone: "err" as const }
            : ctx.percent >= 85
              ? { tone: "warn" as const }
              : {})}
        />
      )}
    </div>
  );
}

interface CellProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: "warn" | "err";
  readonly chart?: React.ReactNode;
  readonly title?: string;
}

/**
 * Inline label + value pair. Renders as `LABEL value` on the same line so
 * three stats fit in a single horizontal strip without the previous
 * column-card layout's wasted vertical real estate.
 */
function Cell({ label, value, tone, chart, title }: CellProps) {
  const valueColor =
    tone === "err"
      ? "var(--err)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--ink)";
  return (
    <div
      className="inline-flex items-center gap-2"
      title={title}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ink-tertiary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: valueColor,
          letterSpacing: "-0.1px",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {chart && <span className="ml-1">{chart}</span>}
    </div>
  );
}
