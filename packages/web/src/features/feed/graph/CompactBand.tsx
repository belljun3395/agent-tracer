import { useMemo } from "react";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import { isContextCompactEvent } from "../lib/is-compact.js";
import {
  msToLeftPercent,
  type TimeRange,
} from "./lib/time-range.js";
import { LANE_LABEL_WIDTH } from "./lib/layout.js";

interface CompactBandProps {
  readonly events: readonly TimelineEventRecord[];
  readonly range: TimeRange;
}

const BAND_WIDTH = 24;
/**
 * Compacts within this distance get merged into a single band — without
 * this, a flurry of context.saved events (e.g. 8 within a minute) renders
 * as 8 overlapping stripes, drowning out the rest of the graph.
 */
const MERGE_THRESHOLD_PERCENT = 1.6;

interface CompactCluster {
  readonly leftPercent: number;
  readonly count: number;
}

/**
 * Vertical amber stripes marking `kind === 'context.saved'` events.
 * Adjacent compacts are merged into a single band with a count badge so
 * dense compaction sequences stay readable.
 */
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
      // Place the band at the cluster's mean — visually centers across
      // its constituent compacts.
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
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `calc(${LANE_LABEL_WIDTH}px + (100% - ${LANE_LABEL_WIDTH}px) * ${cluster.leftPercent / 100} - ${BAND_WIDTH / 2}px)`,
            width: BAND_WIDTH,
            background: "color-mix(in srgb, var(--compact) 12%, transparent)",
            borderLeft: "1px dashed var(--compact)",
            borderRight: "1px dashed var(--compact)",
          }}
        >
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: 6,
              padding: "1px 6px",
              background: "var(--canvas)",
              color: "var(--warn)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.06em",
              border:
                "1px solid color-mix(in srgb, var(--compact) 40%, transparent)",
              borderRadius: 2,
              whiteSpace: "nowrap",
            }}
          >
            {cluster.count > 1 ? `PreCompact ×${cluster.count}` : "PreCompact"}
          </span>
        </div>
      ))}
    </>
  );
}
