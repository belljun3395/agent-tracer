import { useMemo } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { GuidanceMessage } from "~web/shared/guidance.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { formatDuration } from "~web/shared/lib/formatting/time.js";
import { extractContextSnapshot } from "~web/widgets/feed/lib/extraction/extract-context.js";
import { buildContextTrajectory } from "~web/widgets/feed/lib/extraction/extract-context-trajectory.js";
import { isContextCompactEvent } from "~web/widgets/feed/lib/timeline/is-compact.js";
import { ContextSparkline } from "~web/widgets/feed/header/ContextSparkline.js";

interface MetricRailProps {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEventRecord[];
  readonly nowMs: number;
}

/** 태스크 헤더 아래 간결한 메트릭 스트립. */
export function MetricRail({ task, timeline, nowMs }: MetricRailProps) {
  const guidance = useGuidance();
  const startMs = Date.parse(task.lastSessionStartedAt ?? task.createdAt);
  const elapsedMs = Math.max(0, nowMs - startMs);
  const compactCount = timeline.filter(isContextCompactEvent).length;
  const ctx = extractContextSnapshot(timeline);
  const trajectory = useMemo(
    () => buildContextTrajectory(timeline),
    [timeline],
  );

  return (
    <div className="flex items-center gap-5 border-t border-hair mt-3 pt-2.5 bg-transparent">
      <Cell
        label="Active"
        value={formatDuration(elapsedMs)}
        description={guidance.messages.feed.wallClock}
      />
      <Cell
        label="Compacts"
        value={compactCount.toString()}
        description={guidance.messages.feed.compactions}
      />
      {ctx && (
        <Cell
          label="Context"
          value={`${ctx.percent}%`}
          description={guidance.messages.feed.contextUsage}
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
  readonly description: GuidanceMessage;
}

/** 인라인 라벨 + 값 쌍. */
function Cell({ label, value, tone, chart, description }: CellProps) {
  const guidance = useGuidance();
  return (
    <Tooltip content={<GuidanceText locale={guidance.locale} message={description} />}>
      <div className="inline-flex items-center gap-2">
        <span className="font-mono text-[10px] text-ink-tertiary tracking-[0.08em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "text-sm font-semibold tracking-[-0.1px] [font-variant-numeric:tabular-nums] whitespace-nowrap",
            tone === "err" ? "text-err" : tone === "warn" ? "text-warn" : "text-ink",
          )}
        >
          {value}
        </span>
        {chart && <span className="ml-1">{chart}</span>}
      </div>
    </Tooltip>
  );
}
