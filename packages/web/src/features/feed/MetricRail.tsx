import { useMemo } from "react";
import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import { formatDuration } from "./lib/format-time.js";
import { formatCompactCount } from "./lib/extract-metadata.js";
import { extractContextSnapshot } from "./lib/extract-context.js";
import { buildContextTrajectory } from "./lib/extract-context-trajectory.js";
import { buildTokenTotals } from "./lib/extract-token-totals.js";
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
 *   Context  : latest context snapshot (used / limit) plus a
 *              sparkline of the trajectory across the task — shown
 *              only when the runtime emits snapshots with both fields
 *   Tokens   : total input + output across the task (sum of every
 *              event that carried token usage)
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
  const tokens = useMemo(() => buildTokenTotals(timeline), [timeline]);

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
          subtitle={`${formatCompactCount(ctx.used)} / ${formatCompactCount(ctx.limit)}`}
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
      {tokens.sampleCount > 0 && (
        <Cell
          label="Tokens"
          value={formatCompactCount(tokens.totalAll)}
          subtitle={
            tokens.totalIn > 0 || tokens.totalOut > 0
              ? `${formatCompactCount(tokens.totalIn)} in / ${formatCompactCount(tokens.totalOut)} out`
              : `${tokens.sampleCount} sample${tokens.sampleCount === 1 ? "" : "s"}`
          }
        />
      )}
    </div>
  );
}

interface CellProps {
  readonly label: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly tone?: "warn" | "err";
  readonly chart?: React.ReactNode;
}

function Cell({ label, value, subtitle, tone, chart }: CellProps) {
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
      {subtitle && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-tertiary)",
          }}
        >
          {subtitle}
        </span>
      )}
      {chart && <div style={{ marginTop: 4 }}>{chart}</div>}
    </div>
  );
}
