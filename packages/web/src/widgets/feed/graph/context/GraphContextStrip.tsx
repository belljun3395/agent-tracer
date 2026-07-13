import { useMemo } from "react";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { buildContextTrajectory } from "~web/widgets/feed/lib/extraction/extract-context-trajectory.js";
import { buildModelSpans } from "~web/widgets/feed/lib/extraction/extract-model-spans.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";
import { msToLeftPercent, type TimeRange } from "~web/widgets/feed/graph/model/time-range.js";
import {
  LANE_LABEL_WIDTH,
  TRACK_LEFT_PADDING,
} from "~web/widgets/feed/graph/model/track-geometry.js";
import { ContextTrajectoryChart } from "~web/widgets/feed/graph/context/ContextTrajectoryChart.js";
import { ModelSpanBand } from "~web/widgets/feed/graph/context/ModelSpanBand.js";
import {
  CONTEXT_STRIP_HEIGHT,
  contextStroke,
} from "~web/widgets/feed/graph/context/presentation.js";

interface GraphContextStripProps {
  readonly events: readonly TimelineEventRecord[];
  readonly range: TimeRange;
}

/** 컨텍스트 사용률과 모델 전환을 plot과 같은 시간축에 정렬한다. */
export function GraphContextStrip({ events, range }: GraphContextStripProps) {
  const guidance = useGuidance();
  const trajectory = useMemo(() => buildContextTrajectory(events), [events]);
  const modelSpans = useMemo(() => buildModelSpans(events), [events]);

  if (trajectory.length === 0 && modelSpans.length === 0) return null;

  const points = trajectory.map((point) => ({
    leftPercent: msToLeftPercent(point.atMs, range),
    percent: Math.min(100, point.percent),
  }));
  const last = trajectory[trajectory.length - 1];
  const stroke = contextStroke(last?.percent);

  return (
    <div
      className="relative border-t border-hair bg-canvas"
      style={{ height: CONTEXT_STRIP_HEIGHT }}
    >
      <Tooltip
        content={
          <GuidanceText
            locale={guidance.locale}
            message={guidance.messages.feed.graphContext}
          />
        }
      >
        <div
          className="sticky left-0 top-0 h-full float-left bg-s1 border-r border-hair flex items-center pl-3.5 font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-tertiary z-[8] cursor-help"
          style={{ width: LANE_LABEL_WIDTH }}
        >
          Context
        </div>
      </Tooltip>

      <div
        style={{
          marginLeft: LANE_LABEL_WIDTH + TRACK_LEFT_PADDING,
          height: "100%",
          position: "relative",
        }}
      >
        <ContextTrajectoryChart points={points} stroke={stroke} />
        <ModelSpanBand spans={modelSpans} range={range} />
        {last && (
          <div
            className="absolute top-1 right-2 py-px px-1.5 font-mono text-[10px] font-medium bg-canvas rounded-[2px]"
            style={{
              color: stroke,
              border: `1px solid color-mix(in srgb, ${stroke} 40%, transparent)`,
            }}
          >
            {Math.round(last.percent)}%
          </div>
        )}
      </div>
    </div>
  );
}
