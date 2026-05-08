import type { TimeRange } from "./lib/time-range.js";
import { msToLeftPercent } from "./lib/time-range.js";
import { LANE_LABEL_WIDTH } from "./lib/layout.js";

interface NowMarkerProps {
  readonly nowMs: number;
  readonly range: TimeRange;
}

/**
 * Vertical "now" line spanning the lanes. Hidden when the current time
 * sits past the right edge of the visible window — that only happens
 * when the graph is showing a frozen snapshot of a finished task, in
 * which case the marker is meaningless.
 */
export function NowMarker({ nowMs, range }: NowMarkerProps) {
  const leftPercent = msToLeftPercent(nowMs, range);
  if (leftPercent <= 0 || leftPercent >= 100) return null;

  return (
    <div
      aria-hidden
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{
        left: `calc(${LANE_LABEL_WIDTH}px + (100% - ${LANE_LABEL_WIDTH}px) * ${leftPercent / 100})`,
        width: 1,
        background: "var(--ink)",
        zIndex: 6,
      }}
    >
      <span
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 6,
          padding: "1px 6px",
          background: "var(--ink)",
          color: "var(--canvas)",
          fontFamily: "var(--font-mono)",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          borderRadius: 2,
        }}
      >
        NOW
      </span>
    </div>
  );
}
