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
      className="flex items-stretch border-y border-[var(--hair)] my-3 py-2.5"
      style={{ background: "transparent" }}
    >
      <Cell label="Active" value={formatDuration(elapsedMs)} />
      <Cell label="Compacts" value={compactCount.toString()} />
      {ctx && (
        <Cell
          label="Context"
          value={`${ctx.percent}%`}
          chart={
            trajectory.length >= 2 ? (
              <ContextSparkline points={trajectory} width={120} height={26} />
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
}

function Cell({ label, value, tone, chart }: CellProps) {
  const valueColor =
    tone === "err"
      ? "var(--err)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--ink)";
  return (
    <div className="flex flex-col gap-0.5 px-4 flex-1 min-w-0 border-r border-[var(--hair)] last:border-r-0">
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          color: "var(--ink-tertiary)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 17,
          fontWeight: 500,
          color: valueColor,
          letterSpacing: "-0.3px",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
      {chart && <div style={{ marginTop: 4 }}>{chart}</div>}
    </div>
  );
}
