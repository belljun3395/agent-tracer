import { useMemo } from "react";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { isContextCompactEvent } from "~web/widgets/feed/lib/timeline/is-compact.js";
import {
  msToLeftPercent,
  type TimeRange,
} from "~web/widgets/feed/graph/model/time-range.js";
import { trackLeftCss } from "~web/widgets/feed/graph/model/track-geometry.js";

interface CompactBandProps {
  readonly events: readonly TimelineEventRecord[];
  readonly range: TimeRange;
}

const BAND_WIDTH = 24;
/** 이 거리 이내의 compact는 하나의 밴드로 합쳐진다. */
const MERGE_THRESHOLD_PERCENT = 1.6;

interface CompactCluster {
  readonly leftPercent: number;
  readonly count: number;
}

/** context-saved 이벤트를 표시하는 세로 앰버 줄무늬. */
export function CompactBand({ events, range }: CompactBandProps) {
  const clusters = useMemo<readonly CompactCluster[]>(() => {
    const compacts = events
      .filter(isContextCompactEvent)
      .map((e) => msToLeftPercent(Date.parse(e.createdAt), range))
      .sort((a, b) => a - b);
    if (compacts.length === 0) return [];

    const merged: { leftPercents: number[] }[] = [];
    for (const lp of compacts) {
      const tail = merged[merged.length - 1];
      if (
        tail &&
        lp - tail.leftPercents[tail.leftPercents.length - 1]! <
          MERGE_THRESHOLD_PERCENT
      ) {
        tail.leftPercents.push(lp);
      } else {
        merged.push({ leftPercents: [lp] });
      }
    }
    return merged.map((m) => ({
      // 밴드를 클러스터의 평균 위치에 둔다.
      leftPercent:
        m.leftPercents.reduce((s, x) => s + x, 0) / m.leftPercents.length,
      count: m.leftPercents.length,
    }));
  }, [events, range]);

  if (clusters.length === 0) return null;

  return (
    <>
      {clusters.map((cluster, idx) => (
        <div
          key={`compact-${idx}`}
          aria-hidden
          className="absolute top-0 bottom-0 pointer-events-none w-6 bg-compact/12 border-l border-r border-dashed border-compact"
          style={{ left: `calc(${trackLeftCss(cluster.leftPercent)} - ${BAND_WIDTH / 2}px)` }}
        >
          <span className="absolute left-1/2 -translate-x-1/2 top-1.5 py-px px-1.5 bg-canvas text-warn font-mono text-[9px] tracking-[0.06em] border border-compact/40 rounded-[2px] whitespace-nowrap">
            {cluster.count > 1 ? `PreCompact ×${cluster.count}` : "PreCompact"}
          </span>
        </div>
      ))}
    </>
  );
}
